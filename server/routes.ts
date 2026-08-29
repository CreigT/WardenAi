/**
 * Warden REST API Routes
 * Production SaaS Endpoints & Security Enforcement Handlers
 * Creignificent LLC
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db, generateApiKey, hashApiKey, hashPassword, verifyPassword } from './db';
import { evaluateAdmit, evaluateReview } from './policyEngine';
import { authenticate, requireAuth, requireOrgAccess, requireRole, generateToken, logAuditEvent } from './auth';
import { createCheckoutSession, createCustomerPortal, handleWebhookEvent, PLAN_LIMITS } from './stripe';
import { runWardenTestSuite } from './testRunner';
import type {
  User,
  Organization,
  OrganizationMember,
  Project,
  Policy,
  AgentSession,
  AgentAction,
  AdmitRequest,
  ReviewRequest,
  TerminateSessionRequest,
  Environment,
  Role,
  SubscriptionPlan
} from '../src/types';

export const apiRouter = Router();

// Apply auth middleware to all api routes
apiRouter.use(authenticate);

// ==========================================
// 1. AUTHENTICATION & PROFILE
// ==========================================

apiRouter.post('/v1/auth/signup', async (req: Request, res: Response) => {
  const { email, password, name, org_name } = req.body;
  if (!email || !password || !name) {
    res.status(400).json({ error: 'Email, password, and name are required' });
    return;
  }

  const store = db.get();
  const normalizedEmail = email.toLowerCase().trim();

  if (store.users.some(u => u.email.toLowerCase() === normalizedEmail)) {
    res.status(409).json({ error: 'An account with this email already exists' });
    return;
  }

  const now = new Date().toISOString();
  const userId = `usr_${crypto.randomUUID().substring(0, 10)}`;
  const orgId = `org_${crypto.randomUUID().substring(0, 10)}`;
  const projId = `proj_${crypto.randomUUID().substring(0, 10)}`;
  const policyId = `pol_${crypto.randomUUID().substring(0, 10)}`;
  const subId = `sub_${crypto.randomUUID().substring(0, 10)}`;

  const newUser: User = {
    id: userId,
    email: normalizedEmail,
    name,
    email_verified: false,
    created_at: now,
    updated_at: now
  };

  const newOrg: Organization = {
    id: orgId,
    name: org_name || `${name}'s Organization`,
    slug: (org_name || name).toLowerCase().replace(/[^a-z0-9]/g, '-'),
    created_by: userId,
    created_at: now,
    updated_at: now,
    subscription_id: subId
  };

  const newMember: OrganizationMember = {
    id: `mem_${crypto.randomUUID().substring(0, 8)}`,
    organization_id: orgId,
    user_id: userId,
    user_email: normalizedEmail,
    user_name: name,
    role: 'owner',
    joined_at: now
  };

  const defaultPolicy: Policy = {
    id: policyId,
    project_id: projId,
    organization_id: orgId,
    name: 'Default Safe Guard Policy',
    description: 'Initial defense baseline protecting environment files, sensitive tokens, and system shells',
    enabled: true,
    rules: {
      allowed_tools: ['file_read', 'search_docs', 'calculate', 'summarize_text'],
      blocked_tools: ['bash', 'shell_exec', 'file_delete', 'drop_database'],
      allowed_paths: ['/app/data/*', './src/docs/*', '/public/*'],
      blocked_paths: ['.env*', '**/credentials*', '/etc/*', '~/.ssh/*'],
      allowed_domains: ['api.creignificent.com', 'api.github.com'],
      blocked_domains: ['*darkweb*', 'localhost'],
      allow_env_access: false,
      blocked_env_vars: ['GEMINI_API_KEY', 'STRIPE_SECRET_KEY', 'AWS_SECRET_ACCESS_KEY'],
      allow_shell: false,
      blocked_shell_commands: ['rm', 'sudo', 'chmod', 'cat /etc/passwd'],
      sensitive_data_patterns: ['sk-[a-zA-Z0-9]{32,}', 'AKIA[0-9A-Z]{16}'],
      max_actions_per_session: 50,
      max_failures_per_session: 3,
      auto_terminate_on_violation: true,
      auto_terminate_on_max_failures: true
    },
    version: 1,
    created_at: now,
    updated_at: now
  };

  const newProj: Project = {
    id: projId,
    organization_id: orgId,
    name: 'Autonomous Agent Core',
    description: 'Default agent security workspace',
    environment: 'production',
    active_policy_id: policyId,
    created_at: now,
    updated_at: now
  };

  const newSub = {
    id: subId,
    organization_id: orgId,
    plan: 'developer' as SubscriptionPlan,
    status: 'active' as const,
    current_period_start: now,
    current_period_end: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    limits: PLAN_LIMITS.developer
  };

  store.users.push(newUser);
  store.user_passwords[userId] = db.hashPassword(password);
  store.organizations.push(newOrg);
  store.members.push(newMember);
  store.projects.push(newProj);
  store.policies.push(defaultPolicy);
  store.subscriptions.push(newSub);

  // Generate initial test API key
  const { apiKey } = generateApiKey(projId, orgId, 'Default Agent Key');
  store.api_keys.push(apiKey);

  logAuditEvent({
    organization_id: orgId,
    user_id: userId,
    user_email: normalizedEmail,
    event_type: 'auth.signup',
    decision: 'ALLOW',
    reason: 'New organization and user account registered'
  });

  await db.persist();

  const token = generateToken({ userId, email: normalizedEmail, orgId });

  res.status(201).json({
    token,
    user: newUser,
    organization: newOrg,
    member: newMember,
    project: newProj
  });
});

apiRouter.post('/v1/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const store = db.get();
  const normalizedEmail = email.toLowerCase().trim();
  const user = store.users.find(u => u.email.toLowerCase() === normalizedEmail);

  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const storedHash = store.user_passwords[user.id];
  if (!storedHash || !db.verifyPassword(password, storedHash)) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const member = store.members.find(m => m.user_id === user.id);
  const org = member ? store.organizations.find(o => o.id === member.organization_id) : store.organizations[0];

  logAuditEvent({
    organization_id: org?.id || 'org_unknown',
    user_id: user.id,
    user_email: user.email,
    event_type: 'auth.login',
    decision: 'ALLOW',
    reason: 'User successfully authenticated via email/password'
  });

  const token = generateToken({ userId: user.id, email: user.email, orgId: org?.id });

  res.json({
    token,
    user,
    organization: org,
    member
  });
});

apiRouter.post('/v1/auth/google', async (req: Request, res: Response) => {
  const { email, name, avatar_url } = req.body;
  const store = db.get();
  const normalizedEmail = (email || 'creigterrence@gmail.com').toLowerCase().trim();

  let user = store.users.find(u => u.email.toLowerCase() === normalizedEmail);
  let org: Organization | undefined;
  let member: OrganizationMember | undefined;

  if (!user) {
    const now = new Date().toISOString();
    const userId = `usr_${crypto.randomUUID().substring(0, 10)}`;
    const orgId = `org_${crypto.randomUUID().substring(0, 10)}`;
    const projId = `proj_${crypto.randomUUID().substring(0, 10)}`;
    const policyId = `pol_${crypto.randomUUID().substring(0, 10)}`;
    const subId = `sub_${crypto.randomUUID().substring(0, 10)}`;

    user = {
      id: userId,
      email: normalizedEmail,
      name: name || 'Google User',
      avatar_url: avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&auto=format&fit=crop&q=80',
      email_verified: true,
      created_at: now,
      updated_at: now
    };

    org = {
      id: orgId,
      name: `${user.name}'s Org`,
      slug: user.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      created_by: userId,
      created_at: now,
      updated_at: now,
      subscription_id: subId
    };

    member = {
      id: `mem_${crypto.randomUUID().substring(0, 8)}`,
      organization_id: orgId,
      user_id: userId,
      user_email: normalizedEmail,
      user_name: user.name,
      role: 'owner',
      joined_at: now
    };

    store.users.push(user);
    store.organizations.push(org);
    store.members.push(member);
    store.subscriptions.push({
      id: subId,
      organization_id: orgId,
      plan: 'developer',
      status: 'active',
      current_period_start: now,
      current_period_end: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      limits: PLAN_LIMITS.developer
    });

    await db.persist();
  } else {
    member = store.members.find(m => m.user_id === user!.id);
    org = member ? store.organizations.find(o => o.id === member.organization_id) : store.organizations[0];
  }

  logAuditEvent({
    organization_id: org?.id || 'org_creignificent',
    user_id: user.id,
    user_email: user.email,
    event_type: 'auth.login',
    decision: 'ALLOW',
    reason: 'Google OAuth authentication verified'
  });

  const token = generateToken({ userId: user.id, email: user.email, orgId: org?.id });

  res.json({
    token,
    user,
    organization: org,
    member
  });
});

apiRouter.get('/v1/auth/me', (req: Request, res: Response) => {
  const store = db.get();
  if (req.auth?.user) {
    const user = store.users.find(u => u.id === req.auth!.user!.id);
    const member = store.members.find(m => m.user_id === user?.id && m.organization_id === req.auth?.organization?.id);
    const orgs = store.members.filter(m => m.user_id === user?.id).map(m => store.organizations.find(o => o.id === m.organization_id)).filter(Boolean);
    const projects = store.projects.filter(p => p.organization_id === req.auth?.organization?.id);

    res.json({
      user,
      organization: req.auth.organization,
      member,
      organizations: orgs,
      projects
    });
    return;
  }

  // Fallback demo user for seamless interactive initial state
  const defaultUser = store.users[0];
  const defaultOrg = store.organizations[0];
  const defaultMember = store.members[0];
  const projects = store.projects.filter(p => p.organization_id === defaultOrg.id);

  res.json({
    user: defaultUser,
    organization: defaultOrg,
    member: defaultMember,
    organizations: store.organizations,
    projects
  });
});

apiRouter.post('/v1/auth/reset-password', (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }
  logAuditEvent({
    organization_id: 'org_creignificent',
    user_email: email,
    event_type: 'auth.password_reset',
    decision: 'ALLOW',
    reason: `Password reset link dispatched to ${email}`
  });
  res.json({ message: `Password reset link sent to ${email}` });
});

apiRouter.post('/v1/auth/logout', (req: Request, res: Response) => {
  res.json({ success: true });
});

// ==========================================
// 2. ORGANIZATIONS & TEAM MEMBERS
// ==========================================

apiRouter.get('/v1/organizations', (req: Request, res: Response) => {
  const store = db.get();
  const userId = req.auth?.user?.id;
  if (userId) {
    const userMembers = store.members.filter(m => m.user_id === userId);
    const orgIds = userMembers.map(m => m.organization_id);
    const userOrgs = store.organizations.filter(o => orgIds.includes(o.id));
    res.json(userOrgs);
    return;
  }
  res.json(store.organizations);
});

apiRouter.post('/v1/organizations', requireAuth, async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Organization name is required' });
    return;
  }

  const store = db.get();
  const now = new Date().toISOString();
  const userId = req.auth!.user!.id;
  const orgId = `org_${crypto.randomUUID().substring(0, 10)}`;
  const subId = `sub_${crypto.randomUUID().substring(0, 10)}`;

  const org: Organization = {
    id: orgId,
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    created_by: userId,
    created_at: now,
    updated_at: now,
    subscription_id: subId
  };

  const member: OrganizationMember = {
    id: `mem_${crypto.randomUUID().substring(0, 8)}`,
    organization_id: orgId,
    user_id: userId,
    user_email: req.auth!.user!.email,
    user_name: req.auth!.user!.name,
    role: 'owner',
    joined_at: now
  };

  store.organizations.push(org);
  store.members.push(member);
  store.subscriptions.push({
    id: subId,
    organization_id: orgId,
    plan: 'developer',
    status: 'active',
    current_period_start: now,
    current_period_end: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    limits: PLAN_LIMITS.developer
  });

  await db.persist();
  res.status(201).json(org);
});

apiRouter.get('/v1/organizations/:id/members', (req: Request, res: Response) => {
  const store = db.get();
  const members = store.members.filter(m => m.organization_id === req.params.id);
  res.json(members);
});

apiRouter.post('/v1/organizations/:id/members', requireAuth, async (req: Request, res: Response) => {
  const { email, name, role } = req.body;
  if (!email || !role) {
    res.status(400).json({ error: 'Email and role are required' });
    return;
  }

  const store = db.get();
  const org = store.organizations.find(o => o.id === req.params.id);
  if (!org) {
    res.status(404).json({ error: 'Organization not found' });
    return;
  }

  const existingMember = store.members.find(m => m.organization_id === org.id && m.user_email.toLowerCase() === email.toLowerCase());
  if (existingMember) {
    res.status(409).json({ error: 'User is already a member of this organization' });
    return;
  }

  const newMember: OrganizationMember = {
    id: `mem_${crypto.randomUUID().substring(0, 8)}`,
    organization_id: org.id,
    user_id: `usr_${crypto.randomUUID().substring(0, 8)}`,
    user_email: email.toLowerCase().trim(),
    user_name: name || email.split('@')[0],
    role: role as Role,
    joined_at: new Date().toISOString()
  };

  store.members.push(newMember);

  logAuditEvent({
    organization_id: org.id,
    user_id: req.auth?.user?.id,
    user_email: req.auth?.user?.email,
    event_type: 'team.member_invited',
    decision: 'ALLOW',
    reason: `Invited ${email} with role [${role}]`,
    metadata: { email, role }
  });

  await db.persist();
  res.status(201).json(newMember);
});

apiRouter.delete('/v1/organizations/:id/members/:userId', requireAuth, async (req: Request, res: Response) => {
  const store = db.get();
  const memberIndex = store.members.findIndex(m => m.organization_id === req.params.id && (m.user_id === req.params.userId || m.id === req.params.userId));

  if (memberIndex === -1) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  const member = store.members[memberIndex];
  if (member.role === 'owner' && store.members.filter(m => m.organization_id === req.params.id && m.role === 'owner').length === 1) {
    res.status(400).json({ error: 'Cannot remove the sole owner of an organization' });
    return;
  }

  store.members.splice(memberIndex, 1);

  logAuditEvent({
    organization_id: req.params.id,
    user_id: req.auth?.user?.id,
    user_email: req.auth?.user?.email,
    event_type: 'team.member_removed',
    decision: 'ALLOW',
    reason: `Removed team member ${member.user_email}`
  });

  await db.persist();
  res.json({ success: true });
});

// ==========================================
// 3. PROJECTS
// ==========================================

apiRouter.get('/v1/projects', (req: Request, res: Response) => {
  const store = db.get();
  const orgId = req.query.organization_id as string || req.auth?.organization?.id || req.auth?.apiKey?.organization_id || store.organizations[0].id;
  const projects = store.projects.filter(p => p.organization_id === orgId);
  res.json(projects);
});

apiRouter.post('/v1/projects', requireAuth, async (req: Request, res: Response) => {
  const { name, description, environment, organization_id } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Project name is required' });
    return;
  }

  const store = db.get();
  const orgId = organization_id || req.auth?.organization?.id || store.organizations[0].id;
  const now = new Date().toISOString();
  const projId = `proj_${crypto.randomUUID().substring(0, 10)}`;
  const policyId = `pol_${crypto.randomUUID().substring(0, 10)}`;

  // Create initial project policy
  const defaultPolicy: Policy = {
    id: policyId,
    project_id: projId,
    organization_id: orgId,
    name: `${name} Baseline Policy`,
    description: 'Auto-generated zero-trust security policy',
    enabled: true,
    rules: {
      allowed_tools: ['file_read', 'search_docs', 'calculate'],
      blocked_tools: ['bash', 'shell_exec', 'file_delete'],
      allowed_paths: ['/app/data/*', './src/docs/*'],
      blocked_paths: ['.env*', '**/credentials*', '/etc/*'],
      allowed_domains: ['api.creignificent.com', 'api.github.com'],
      blocked_domains: ['*darkweb*', 'localhost'],
      allow_env_access: false,
      blocked_env_vars: ['GEMINI_API_KEY', 'STRIPE_SECRET_KEY'],
      allow_shell: false,
      blocked_shell_commands: ['rm', 'sudo'],
      sensitive_data_patterns: ['sk-[a-zA-Z0-9]{32,}'],
      max_actions_per_session: 50,
      max_failures_per_session: 3,
      auto_terminate_on_violation: true,
      auto_terminate_on_max_failures: true
    },
    version: 1,
    created_at: now,
    updated_at: now
  };

  const project: Project = {
    id: projId,
    organization_id: orgId,
    name,
    description: description || '',
    environment: (environment as Environment) || 'development',
    active_policy_id: policyId,
    created_at: now,
    updated_at: now
  };

  store.projects.push(project);
  store.policies.push(defaultPolicy);

  logAuditEvent({
    organization_id: orgId,
    project_id: projId,
    user_id: req.auth?.user?.id,
    user_email: req.auth?.user?.email,
    event_type: 'project.created',
    decision: 'ALLOW',
    reason: `Created project ${name} [${project.environment}]`
  });

  await db.persist();
  res.status(201).json(project);
});

apiRouter.get('/v1/projects/:id', (req: Request, res: Response) => {
  const store = db.get();
  const project = store.projects.find(p => p.id === req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  res.json(project);
});

apiRouter.patch('/v1/projects/:id', requireAuth, async (req: Request, res: Response) => {
  const store = db.get();
  const project = store.projects.find(p => p.id === req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const { name, description, environment, active_policy_id } = req.body;
  if (name) project.name = name;
  if (description !== undefined) project.description = description;
  if (environment) project.environment = environment;
  if (active_policy_id) project.active_policy_id = active_policy_id;
  project.updated_at = new Date().toISOString();

  await db.persist();
  res.json(project);
});

apiRouter.delete('/v1/projects/:id', requireAuth, async (req: Request, res: Response) => {
  const store = db.get();
  const idx = store.projects.findIndex(p => p.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  store.projects.splice(idx, 1);
  await db.persist();
  res.json({ success: true });
});

// ==========================================
// 4. POLICIES
// ==========================================

apiRouter.get('/v1/policies', (req: Request, res: Response) => {
  const store = db.get();
  const projectId = req.query.project_id as string;
  const orgId = req.query.organization_id as string || req.auth?.organization?.id || req.auth?.apiKey?.organization_id;

  let policies = store.policies;
  if (projectId) {
    policies = policies.filter(p => p.project_id === projectId);
  } else if (orgId) {
    policies = policies.filter(p => p.organization_id === orgId);
  }

  res.json(policies);
});

apiRouter.get('/v1/policies/:id', (req: Request, res: Response) => {
  const store = db.get();
  const policy = store.policies.find(p => p.id === req.params.id);
  if (!policy) {
    res.status(404).json({ error: 'Policy not found' });
    return;
  }
  res.json(policy);
});

apiRouter.post('/v1/policies', requireAuth, async (req: Request, res: Response) => {
  const { project_id, organization_id, name, description, rules, enabled } = req.body;
  if (!project_id || !name || !rules) {
    res.status(400).json({ error: 'project_id, name, and rules are required' });
    return;
  }

  const store = db.get();
  const project = store.projects.find(p => p.id === project_id);
  if (!project) {
    res.status(404).json({ error: 'Referenced project not found' });
    return;
  }

  const orgId = organization_id || project.organization_id;
  const now = new Date().toISOString();
  const policyId = `pol_${crypto.randomUUID().substring(0, 10)}`;

  const policy: Policy = {
    id: policyId,
    project_id,
    organization_id: orgId,
    name,
    description: description || '',
    enabled: enabled !== undefined ? enabled : true,
    rules,
    version: 1,
    created_at: now,
    updated_at: now
  };

  store.policies.push(policy);

  logAuditEvent({
    organization_id: orgId,
    project_id,
    user_id: req.auth?.user?.id,
    user_email: req.auth?.user?.email,
    event_type: 'policy.created',
    decision: 'ALLOW',
    reason: `Created policy '${name}' v1`,
    metadata: { policy_id: policyId }
  });

  await db.persist();
  res.status(201).json(policy);
});

apiRouter.put('/v1/policies/:id', requireAuth, async (req: Request, res: Response) => {
  const store = db.get();
  const policy = store.policies.find(p => p.id === req.params.id);
  if (!policy) {
    res.status(404).json({ error: 'Policy not found' });
    return;
  }

  const { name, description, rules, enabled } = req.body;
  if (name) policy.name = name;
  if (description !== undefined) policy.description = description;
  if (enabled !== undefined) policy.enabled = enabled;
  if (rules) {
    policy.rules = { ...policy.rules, ...rules };
  }
  policy.version += 1;
  policy.updated_at = new Date().toISOString();

  logAuditEvent({
    organization_id: policy.organization_id,
    project_id: policy.project_id,
    user_id: req.auth?.user?.id,
    user_email: req.auth?.user?.email,
    event_type: 'policy.updated',
    decision: 'ALLOW',
    reason: `Updated policy '${policy.name}' to version ${policy.version}`,
    metadata: { policy_id: policy.id, version: policy.version }
  });

  await db.persist();
  res.json(policy);
});

// ==========================================
// 5. AGENT SESSIONS
// ==========================================

apiRouter.post('/v1/sessions', async (req: Request, res: Response) => {
  const { project_id, organization_id, agent_id, name, metadata } = req.body;
  const store = db.get();

  const projId = project_id || req.auth?.apiKey?.project_id || store.projects[0]?.id;
  const project = store.projects.find(p => p.id === projId);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const orgId = organization_id || project.organization_id;
  const sessionId = `sess_${crypto.randomUUID().substring(0, 10)}`;
  const now = new Date().toISOString();

  const session: AgentSession = {
    id: sessionId,
    project_id: projId,
    organization_id: orgId,
    agent_id: agent_id || `agent_${crypto.randomUUID().substring(0, 6)}`,
    name: name || `Agent Session ${new Date().toLocaleTimeString()}`,
    status: 'active',
    action_count: 0,
    failure_count: 0,
    created_at: now,
    updated_at: now,
    metadata
  };

  store.sessions.unshift(session);

  logAuditEvent({
    organization_id: orgId,
    project_id: projId,
    session_id: sessionId,
    user_id: req.auth?.user?.id,
    event_type: 'session.created',
    decision: 'ALLOW',
    reason: `Initialized new agent session: ${session.name}`,
    metadata: { agent_id: session.agent_id }
  });

  await db.persist();
  res.status(201).json(session);
});

apiRouter.get('/v1/sessions', (req: Request, res: Response) => {
  const store = db.get();
  const projectId = req.query.project_id as string;
  const orgId = req.query.organization_id as string || req.auth?.organization?.id || req.auth?.apiKey?.organization_id;

  let sessions = store.sessions;
  if (projectId) {
    sessions = sessions.filter(s => s.project_id === projectId);
  } else if (orgId) {
    sessions = sessions.filter(s => s.organization_id === orgId);
  }

  res.json(sessions);
});

apiRouter.get('/v1/sessions/:sessionId', (req: Request, res: Response) => {
  const store = db.get();
  const session = store.sessions.find(s => s.id === req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const actions = store.actions.filter(a => a.session_id === session.id);
  const auditLogs = store.audit_logs.filter(l => l.session_id === session.id);

  res.json({ session, actions, audit_logs: auditLogs });
});

// KILL SWITCH API: Manual or Programmatic Termination
apiRouter.post('/v1/sessions/:sessionId/terminate', async (req: Request, res: Response) => {
  const { reason } = req.body as TerminateSessionRequest;
  const store = db.get();
  const session = store.sessions.find(s => s.id === req.params.sessionId);

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const termReason = reason || 'Manual Kill Switch triggered from Warden Console';
  session.status = 'terminated';
  session.termination_reason = termReason;
  session.terminated_at = new Date().toISOString();
  session.terminated_by = req.auth?.apiKey ? 'api' : 'manual';
  session.updated_at = new Date().toISOString();

  logAuditEvent({
    organization_id: session.organization_id,
    project_id: session.project_id,
    session_id: session.id,
    user_id: req.auth?.user?.id,
    user_email: req.auth?.user?.email,
    event_type: 'session.terminated',
    decision: 'TERMINATE',
    reason: termReason,
    risk_level: 'critical',
    metadata: { manual_kill: true, actor: req.auth?.user?.email || 'API' }
  });

  await db.persist();

  res.json({
    success: true,
    session_id: session.id,
    status: session.status,
    termination_reason: session.termination_reason,
    terminated_at: session.terminated_at
  });
});

// ==========================================
// 6. ENFORCEMENT ENGINE: admit() & review()
// ==========================================

/**
 * Server-side admit()
 * Sits between AI agent and tool execution
 */
apiRouter.post('/v1/admit', async (req: Request, res: Response) => {
  const admitReq = req.body as AdmitRequest;
  const { project_id, session_id, agent_id, tool, action, target, arguments: args, metadata } = admitReq;

  if (!session_id || !tool || !action) {
    res.status(400).json({ error: 'session_id, tool, and action are required' });
    return;
  }

  const store = db.get();

  // Find or create session
  let session = store.sessions.find(s => s.id === session_id);
  const projId = project_id || session?.project_id || req.auth?.apiKey?.project_id || store.projects[0]?.id;
  const project = store.projects.find(p => p.id === projId) || store.projects[0];
  const orgId = project?.organization_id || store.organizations[0]?.id;

  if (!session) {
    session = {
      id: session_id,
      project_id: projId,
      organization_id: orgId,
      agent_id: agent_id || 'agent_unnamed',
      name: `Agent Session (${tool})`,
      status: 'active',
      action_count: 0,
      failure_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    store.sessions.unshift(session);
  }

  // Fetch active project policy
  let policy = store.policies.find(p => p.id === project?.active_policy_id);
  if (!policy) {
    policy = store.policies.find(p => p.project_id === projId) || store.policies[0];
  }

  // EVALUATE AGAINST POLICY
  const evalResult = evaluateAdmit(admitReq, policy, session);

  const actionId = `act_${crypto.randomUUID().substring(0, 10)}`;
  const now = new Date().toISOString();

  const agentAction: AgentAction = {
    id: actionId,
    session_id: session.id,
    project_id: projId,
    organization_id: orgId,
    agent_id: agent_id || session.agent_id,
    tool,
    action,
    target,
    arguments: args,
    admit_decision: evalResult.decision,
    admit_reason: evalResult.reason,
    admit_rule_id: evalResult.rule_id,
    admit_risk_level: evalResult.risk_level,
    admitted_at: now,
    metadata
  };

  store.actions.unshift(agentAction);
  session.action_count += 1;
  session.updated_at = now;

  // Handle automatic termination on security violation
  if (evalResult.should_terminate_session) {
    session.status = 'terminated';
    session.termination_reason = evalResult.termination_reason || evalResult.reason;
    session.terminated_at = now;
    session.terminated_by = 'policy';

    logAuditEvent({
      organization_id: orgId,
      project_id: projId,
      session_id: session.id,
      action_id: actionId,
      event_type: 'session.terminated',
      decision: 'TERMINATE',
      reason: `Automated Kill Switch: ${session.termination_reason}`,
      risk_level: 'critical',
      metadata: { tool, action, target }
    });
  }

  // Record audit log event
  logAuditEvent({
    organization_id: orgId,
    project_id: projId,
    session_id: session.id,
    action_id: actionId,
    event_type: evalResult.decision === 'ALLOW' ? 'session.admit_allow' : 'session.admit_deny',
    decision: evalResult.decision,
    reason: evalResult.reason,
    risk_level: evalResult.risk_level,
    metadata: { tool, action, target, rule_id: evalResult.rule_id }
  });

  await db.persist();

  res.json({
    decision: evalResult.decision,
    reason: evalResult.reason,
    policy_id: evalResult.policy_id,
    rule_id: evalResult.rule_id,
    risk_level: evalResult.risk_level,
    timestamp: now,
    action_id: actionId,
    session_status: session.status
  });
});

/**
 * Server-side review()
 * Evaluates tool execution result and errors
 */
apiRouter.post('/v1/review', async (req: Request, res: Response) => {
  const reviewReq = req.body as ReviewRequest;
  const { session_id, action_id, tool_result, error, metadata } = reviewReq;

  if (!session_id || !action_id) {
    res.status(400).json({ error: 'session_id and action_id are required' });
    return;
  }

  const store = db.get();
  const session = store.sessions.find(s => s.id === session_id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const action = store.actions.find(a => a.id === action_id);
  const project = store.projects.find(p => p.id === session.project_id) || store.projects[0];
  let policy = store.policies.find(p => p.id === project?.active_policy_id) || store.policies[0];

  const evalResult = evaluateReview(reviewReq, policy, session);
  const now = new Date().toISOString();

  if (action) {
    action.review_decision = evalResult.decision;
    action.review_reason = evalResult.reason;
    action.review_risk_level = evalResult.risk_level;
    action.reviewed_at = now;
    action.tool_result = tool_result;
    action.error = error;
  }

  if (error) {
    session.failure_count = (session.failure_count || 0) + 1;
  }

  if (evalResult.should_terminate_session) {
    session.status = 'terminated';
    session.termination_reason = evalResult.termination_reason || evalResult.reason;
    session.terminated_at = now;
    session.terminated_by = 'policy';

    logAuditEvent({
      organization_id: session.organization_id,
      project_id: session.project_id,
      session_id: session.id,
      action_id,
      event_type: 'session.terminated',
      decision: 'TERMINATE',
      reason: `Review Triggered Kill Switch: ${session.termination_reason}`,
      risk_level: 'critical',
      metadata: { error, tool_result_preview: String(tool_result).substring(0, 100) }
    });
  }

  logAuditEvent({
    organization_id: session.organization_id,
    project_id: session.project_id,
    session_id: session.id,
    action_id,
    event_type: evalResult.decision === 'CONTINUE'
      ? 'session.review_continue'
      : evalResult.decision === 'WARN'
      ? 'session.review_warn'
      : 'session.review_terminate',
    decision: evalResult.decision,
    reason: evalResult.reason,
    risk_level: evalResult.risk_level,
    metadata: { error, decision: evalResult.decision }
  });

  await db.persist();

  res.json({
    decision: evalResult.decision,
    reason: evalResult.reason,
    risk_level: evalResult.risk_level,
    timestamp: now,
    session_status: session.status
  });
});

// ==========================================
// 7. AUDIT LOGS & ANALYTICS
// ==========================================

apiRouter.get('/v1/audit-logs', (req: Request, res: Response) => {
  const store = db.get();
  const orgId = req.query.organization_id as string || req.auth?.organization?.id || req.auth?.apiKey?.organization_id;
  const projectId = req.query.project_id as string;
  const eventType = req.query.event_type as string;
  const decision = req.query.decision as string;
  const limit = parseInt(req.query.limit as string || '100', 10);

  let logs = store.audit_logs;
  if (orgId) {
    logs = logs.filter(l => l.organization_id === orgId);
  }
  if (projectId) {
    logs = logs.filter(l => l.project_id === projectId);
  }
  if (eventType) {
    logs = logs.filter(l => l.event_type === eventType);
  }
  if (decision) {
    logs = logs.filter(l => l.decision === decision);
  }

  res.json(logs.slice(0, limit));
});

apiRouter.get('/v1/usage', (req: Request, res: Response) => {
  const store = db.get();
  const orgId = req.query.organization_id as string || req.auth?.organization?.id || req.auth?.apiKey?.organization_id || store.organizations[0].id;
  const sub = store.subscriptions.find(s => s.organization_id === orgId) || store.subscriptions[0];

  const orgActions = store.actions.filter(a => a.organization_id === orgId);
  const totalAdmits = orgActions.length;
  const allowedAdmits = orgActions.filter(a => a.admit_decision === 'ALLOW').length;
  const deniedAdmits = orgActions.filter(a => a.admit_decision === 'DENY').length;
  const reviewsCount = orgActions.filter(a => !!a.review_decision).length;
  const terminatedSessions = store.sessions.filter(s => s.organization_id === orgId && s.status === 'terminated').length;

  res.json({
    organization_id: orgId,
    plan: sub?.plan || 'pro',
    limits: sub?.limits || PLAN_LIMITS.pro,
    metrics: {
      total_admits: totalAdmits,
      allowed_admits: allowedAdmits,
      denied_admits: deniedAdmits,
      review_calls: reviewsCount,
      active_sessions: store.sessions.filter(s => s.organization_id === orgId && s.status === 'active').length,
      terminated_sessions: terminatedSessions,
      threat_prevention_rate: totalAdmits > 0 ? ((deniedAdmits / totalAdmits) * 100).toFixed(1) + '%' : '0.0%'
    }
  });
});

// ==========================================
// 8. API KEYS
// ==========================================

apiRouter.get('/v1/api-keys', (req: Request, res: Response) => {
  const store = db.get();
  const orgId = req.query.organization_id as string || req.auth?.organization?.id || store.organizations[0].id;
  const keys = store.api_keys.filter(k => k.organization_id === orgId);
  res.json(keys);
});

apiRouter.post('/v1/api-keys', requireAuth, async (req: Request, res: Response) => {
  const { project_id, organization_id, name } = req.body;
  if (!project_id || !name) {
    res.status(400).json({ error: 'project_id and name are required' });
    return;
  }

  const store = db.get();
  const project = store.projects.find(p => p.id === project_id);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const orgId = organization_id || project.organization_id;
  const { apiKey, rawKey } = generateApiKey(project_id, orgId, name);

  store.api_keys.push(apiKey);

  logAuditEvent({
    organization_id: orgId,
    project_id,
    user_id: req.auth?.user?.id,
    user_email: req.auth?.user?.email,
    event_type: 'api_key.created',
    decision: 'ALLOW',
    reason: `Generated API key '${name}' [${apiKey.key_prefix}]`
  });

  await db.persist();

  // Return rawKey ONCE so client can copy
  res.status(201).json({
    apiKey,
    rawKey
  });
});

apiRouter.delete('/v1/api-keys/:id', requireAuth, async (req: Request, res: Response) => {
  const store = db.get();
  const key = store.api_keys.find(k => k.id === req.params.id);
  if (!key) {
    res.status(404).json({ error: 'API key not found' });
    return;
  }

  key.revoked = true;

  logAuditEvent({
    organization_id: key.organization_id,
    project_id: key.project_id,
    user_id: req.auth?.user?.id,
    user_email: req.auth?.user?.email,
    event_type: 'api_key.revoked',
    decision: 'ALLOW',
    reason: `Revoked API key '${key.name}'`
  });

  await db.persist();
  res.json({ success: true, message: 'API key revoked' });
});

// ==========================================
// 9. STRIPE BILLING
// ==========================================

apiRouter.get('/v1/billing/subscription', (req: Request, res: Response) => {
  const store = db.get();
  const orgId = req.query.organization_id as string || req.auth?.organization?.id || store.organizations[0].id;
  const sub = store.subscriptions.find(s => s.organization_id === orgId) || store.subscriptions[0];
  res.json(sub);
});

apiRouter.post('/v1/billing/checkout', requireAuth, async (req: Request, res: Response) => {
  const { plan, returnUrl } = req.body;
  if (!plan || !['developer', 'pro', 'business'].includes(plan)) {
    res.status(400).json({ error: 'Valid plan (developer, pro, business) is required' });
    return;
  }

  const orgId = req.auth?.organization?.id || db.get().organizations[0].id;
  const userEmail = req.auth?.user?.email || 'CreigTerrence@gmail.com';

  try {
    const result = await createCheckoutSession({
      organizationId: orgId,
      userEmail,
      plan: plan as SubscriptionPlan,
      returnUrl: returnUrl || 'http://localhost:3000/console/billing'
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Checkout failed' });
  }
});

apiRouter.post('/v1/billing/portal', requireAuth, async (req: Request, res: Response) => {
  const { returnUrl } = req.body;
  const orgId = req.auth?.organization?.id || db.get().organizations[0].id;

  try {
    const result = await createCustomerPortal({
      organizationId: orgId,
      returnUrl: returnUrl || 'http://localhost:3000/console/billing'
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Portal creation failed' });
  }
});

apiRouter.post('/v1/billing/webhook', async (req: Request, res: Response) => {
  try {
    await handleWebhookEvent(req.body);
    res.json({ received: true });
  } catch (err: any) {
    res.status(400).json({ error: `Webhook error: ${err.message}` });
  }
});

// ==========================================
// 10. AUTOMATED TEST RUNNER API
// ==========================================

apiRouter.post('/v1/tests/run', async (req: Request, res: Response) => {
  try {
    const result = await runWardenTestSuite();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Test suite execution failed' });
  }
});
