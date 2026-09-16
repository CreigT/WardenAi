/**
 * WardenAI v1 enforcement gateway.
 * Agents never receive upstream production credentials. Privileged actions are
 * admitted, optionally human-reviewed, executed by WardenAI, and audited.
 */
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from './db';
import { authenticate, requireAuth, requireRole, logAuditEvent } from './auth';
import { evaluateAdmit } from './policyEngine';
import type { AgentAction, AgentSession, AdmitRequest, Decision, HumanReviewDecision, IntegrationStatus } from '../src/types';

export const controlPlaneRouter = Router();
controlPlaneRouter.use(authenticate);

function activeOrgId(req: Request): string | undefined {
  return req.auth?.organization?.id || req.auth?.apiKey?.organization_id;
}

function classifyPrivilegedAction(toolRaw: string, actionRaw: string): Decision | null {
  const tool = toolRaw.toLowerCase().trim();
  const action = actionRaw.toLowerCase().trim();
  const signature = `${tool}.${action}`;

  const hardDenied = [
    'gmail.bulk_delete',
    'gmail.export_credentials',
    'credentials.read_secret',
    'credentials.export',
    'stripe.export_secret_key',
    'github.delete_repository'
  ];
  if (hardDenied.includes(signature)) return 'DENY';

  const reviewActions = [
    'send', 'delete', 'publish', 'deploy', 'merge', 'refund', 'charge', 'pay',
    'transfer', 'cancel', 'invite', 'remove_member', 'change_permissions'
  ];
  if (reviewActions.some(value => action === value || action.includes(value))) return 'REVIEW';

  return null;
}

function getPolicyForSession(session: AgentSession) {
  const store = db.get();
  const project = store.projects.find(p => p.id === session.project_id) || store.projects[0];
  return store.policies.find(p => p.id === project?.active_policy_id)
    || store.policies.find(p => p.project_id === session.project_id)
    || store.policies[0];
}

// Override the legacy admit route with ALLOW | REVIEW | DENY semantics.
controlPlaneRouter.post('/v1/admit', requireAuth, async (req: Request, res: Response) => {
  const admitReq = req.body as AdmitRequest;
  const { project_id, session_id, agent_id, tool, action, target, arguments: args, metadata } = admitReq;
  if (!session_id || !tool || !action) {
    res.status(400).json({ error: 'session_id, tool, and action are required' });
    return;
  }

  const store = db.get();
  let session = store.sessions.find(s => s.id === session_id);
  const projId = project_id || session?.project_id || req.auth?.apiKey?.project_id;
  const project = store.projects.find(p => p.id === projId);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const orgId = project.organization_id;
  const authOrg = activeOrgId(req);
  if (!authOrg || authOrg !== orgId) {
    res.status(403).json({ error: 'Forbidden: project is outside the active organization' });
    return;
  }

  if (!session) {
    session = {
      id: session_id,
      project_id: project.id,
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

  if (session.organization_id !== orgId) {
    res.status(403).json({ error: 'Forbidden: session organization mismatch' });
    return;
  }

  const policy = getPolicyForSession(session);
  if (!policy) {
    res.status(503).json({ error: 'No active policy is configured for this project' });
    return;
  }

  const evaluated = evaluateAdmit(admitReq, policy, session);
  const privilegedDecision = evaluated.decision === 'ALLOW' ? classifyPrivilegedAction(tool, action) : null;
  const decision: Decision = privilegedDecision || evaluated.decision;
  const reason = decision === 'REVIEW'
    ? `Policy checks passed, but '${tool}.${action}' is privileged and requires human approval before execution.`
    : decision === 'DENY' && privilegedDecision === 'DENY'
      ? `Action '${tool}.${action}' is prohibited by the WardenAI hard-deny boundary.`
      : evaluated.reason;
  const riskLevel = decision === 'REVIEW' ? 'high' : evaluated.risk_level;

  const actionId = `act_${crypto.randomUUID().substring(0, 10)}`;
  const now = new Date().toISOString();
  const agentAction: AgentAction = {
    id: actionId,
    session_id: session.id,
    project_id: project.id,
    organization_id: orgId,
    agent_id: agent_id || session.agent_id,
    tool,
    action,
    target,
    arguments: args,
    admit_decision: decision,
    admit_reason: reason,
    admit_rule_id: decision === 'REVIEW' ? 'rule_human_review_required' : evaluated.rule_id,
    admit_risk_level: riskLevel,
    admitted_at: now,
    execution_status: decision === 'DENY' ? 'rejected' : 'pending',
    metadata
  };

  store.actions.unshift(agentAction);
  session.action_count += 1;
  session.updated_at = now;

  if (evaluated.should_terminate_session) {
    session.status = 'terminated';
    session.termination_reason = evaluated.termination_reason || evaluated.reason;
    session.terminated_at = now;
    session.terminated_by = 'policy';
  }

  const eventType = decision === 'ALLOW'
    ? 'session.admit_allow'
    : decision === 'REVIEW'
      ? 'session.admit_review'
      : 'session.admit_deny';

  logAuditEvent({
    organization_id: orgId,
    project_id: project.id,
    session_id: session.id,
    action_id: actionId,
    event_type: eventType,
    decision,
    reason,
    risk_level: riskLevel,
    metadata: { tool, action, target, rule_id: agentAction.admit_rule_id }
  });

  if (decision === 'REVIEW') {
    logAuditEvent({
      organization_id: orgId,
      project_id: project.id,
      session_id: session.id,
      action_id: actionId,
      event_type: 'session.review_requested',
      decision: 'REVIEW',
      reason: 'Privileged action queued for human approval',
      risk_level: 'high',
      metadata: { tool, action }
    });
  }

  await db.persist();
  res.json({
    decision,
    reason,
    policy_id: policy.id,
    rule_id: agentAction.admit_rule_id,
    risk_level: riskLevel,
    timestamp: now,
    action_id: actionId,
    session_status: session.status
  });
});

controlPlaneRouter.get('/v1/reviews', requireAuth, (req: Request, res: Response) => {
  const orgId = activeOrgId(req);
  const pending = db.get().actions
    .filter(a => a.organization_id === orgId && a.admit_decision === 'REVIEW' && !a.human_review_decision)
    .map(a => ({
      id: a.id,
      session_id: a.session_id,
      agent_id: a.agent_id,
      tool: a.tool,
      action: a.action,
      target: a.target,
      reason: a.admit_reason,
      risk_level: a.admit_risk_level,
      admitted_at: a.admitted_at
    }));
  res.json(pending);
});

controlPlaneRouter.post('/v1/reviews/:actionId', requireAuth, requireRole(['owner', 'admin']), async (req: Request, res: Response) => {
  const { decision, reason } = req.body as { decision: HumanReviewDecision; reason?: string };
  if (decision !== 'APPROVE' && decision !== 'REJECT') {
    res.status(400).json({ error: 'decision must be APPROVE or REJECT' });
    return;
  }

  const store = db.get();
  const action = store.actions.find(a => a.id === req.params.actionId);
  const orgId = activeOrgId(req);
  if (!action || action.organization_id !== orgId) {
    res.status(404).json({ error: 'Review action not found' });
    return;
  }
  if (action.admit_decision !== 'REVIEW') {
    res.status(409).json({ error: 'This action is not awaiting human review' });
    return;
  }
  if (action.human_review_decision) {
    res.status(409).json({ error: `Action was already ${action.human_review_decision.toLowerCase()}` });
    return;
  }

  action.human_review_decision = decision;
  action.human_review_reason = reason || (decision === 'APPROVE' ? 'Approved by human reviewer' : 'Rejected by human reviewer');
  action.human_reviewed_at = new Date().toISOString();
  action.human_reviewed_by = req.auth?.user?.email || req.auth?.user?.id || 'human-reviewer';
  action.execution_status = decision === 'APPROVE' ? 'approved' : 'rejected';

  logAuditEvent({
    organization_id: action.organization_id,
    project_id: action.project_id,
    session_id: action.session_id,
    action_id: action.id,
    user_id: req.auth?.user?.id,
    user_email: req.auth?.user?.email,
    event_type: decision === 'APPROVE' ? 'session.review_approved' : 'session.review_rejected',
    decision,
    reason: action.human_review_reason,
    risk_level: action.admit_risk_level,
    metadata: { tool: action.tool, action: action.action }
  });

  await db.persist();
  res.json({ success: true, action_id: action.id, decision, execution_status: action.execution_status });
});

async function executeGmail(action: AgentAction) {
  const token = process.env.GMAIL_ACCESS_TOKEN;
  if (!token) throw new Error('Gmail credential proxy is not configured. Set GMAIL_ACCESS_TOKEN in the server environment.');

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const verb = action.action.toLowerCase();
  const args = action.arguments || {};

  if (verb === 'search' || verb === 'list') {
    const q = encodeURIComponent(String(args.query || args.q || ''));
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=${q}`, { headers });
    if (!response.ok) throw new Error(`Gmail search failed with HTTP ${response.status}`);
    return response.json();
  }

  if (verb === 'read') {
    const messageId = String(args.message_id || action.target || '');
    if (!messageId) throw new Error('message_id is required for gmail.read');
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=metadata`, { headers });
    if (!response.ok) throw new Error(`Gmail read failed with HTTP ${response.status}`);
    return response.json();
  }

  if (verb === 'send') {
    const to = String(args.to || '');
    const subject = String(args.subject || '');
    const body = String(args.body || '');
    if (!to || !subject) throw new Error('to and subject are required for gmail.send');
    const mime = `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${body}`;
    const raw = Buffer.from(mime).toString('base64url');
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST', headers, body: JSON.stringify({ raw })
    });
    if (!response.ok) throw new Error(`Gmail send failed with HTTP ${response.status}`);
    return response.json();
  }

  throw new Error(`Unsupported Gmail action '${action.action}'`);
}

controlPlaneRouter.post('/v1/execute', requireAuth, async (req: Request, res: Response) => {
  const actionId = String(req.body?.action_id || '');
  const store = db.get();
  const action = store.actions.find(a => a.id === actionId);
  const orgId = activeOrgId(req);
  if (!action || action.organization_id !== orgId) {
    res.status(404).json({ error: 'Action not found' });
    return;
  }

  const session = store.sessions.find(s => s.id === action.session_id);
  if (!session || session.status !== 'active') {
    res.status(409).json({ error: 'Session is not active. Kill-switch and session state are enforced before execution.' });
    return;
  }
  if (action.admit_decision === 'DENY') {
    res.status(403).json({ error: 'Denied actions can never be executed' });
    return;
  }
  if (action.admit_decision === 'REVIEW' && action.human_review_decision !== 'APPROVE') {
    res.status(403).json({ error: 'Human approval is required before this action can execute' });
    return;
  }
  if (action.execution_status === 'executed') {
    res.status(409).json({ error: 'Action has already executed; duplicate execution blocked' });
    return;
  }

  action.execution_status = 'approved';
  logAuditEvent({
    organization_id: action.organization_id,
    project_id: action.project_id,
    session_id: action.session_id,
    action_id: action.id,
    event_type: 'session.execution_started',
    decision: action.admit_decision,
    reason: 'WardenAI began credential-isolated tool execution',
    risk_level: action.admit_risk_level,
    metadata: { provider: action.tool, action: action.action }
  });

  try {
    let result: any;
    if (action.tool.toLowerCase() === 'gmail') {
      logAuditEvent({
        organization_id: action.organization_id,
        project_id: action.project_id,
        session_id: action.session_id,
        action_id: action.id,
        event_type: 'credential.accessed',
        decision: 'ALLOW',
        reason: 'Server-side Gmail credential used by WardenAI proxy; secret was not returned to the agent',
        risk_level: 'medium',
        metadata: { provider: 'gmail' }
      });
      result = await executeGmail(action);
    } else {
      throw new Error(`No credential proxy is implemented for tool '${action.tool}'. Gmail is the v1 live gateway.`);
    }

    action.execution_status = 'executed';
    action.executed_at = new Date().toISOString();
    action.tool_result = { status: 'ok', provider: action.tool };
    logAuditEvent({
      organization_id: action.organization_id,
      project_id: action.project_id,
      session_id: action.session_id,
      action_id: action.id,
      event_type: 'session.execution_succeeded',
      decision: 'ALLOW',
      reason: `WardenAI executed ${action.tool}.${action.action} successfully`,
      risk_level: 'low',
      metadata: { provider: action.tool, action: action.action }
    });
    await db.persist();
    res.json({ success: true, action_id: action.id, provider: action.tool, execution_status: action.execution_status, result });
  } catch (error: any) {
    action.execution_status = 'failed';
    action.error = error?.message || 'Execution failed';
    session.failure_count = (session.failure_count || 0) + 1;
    logAuditEvent({
      organization_id: action.organization_id,
      project_id: action.project_id,
      session_id: action.session_id,
      action_id: action.id,
      event_type: 'session.execution_failed',
      decision: 'DENY',
      reason: action.error,
      risk_level: 'high',
      metadata: { provider: action.tool, action: action.action }
    });
    await db.persist();
    res.status(502).json({ success: false, action_id: action.id, provider: action.tool, execution_status: action.execution_status, error: action.error });
  }
});

controlPlaneRouter.post('/v1/agents/:agentId/kill', requireAuth, requireRole(['owner', 'admin']), async (req: Request, res: Response) => {
  const store = db.get();
  const orgId = activeOrgId(req);
  const matches = store.sessions.filter(s => s.organization_id === orgId && s.agent_id === req.params.agentId && s.status === 'active');
  const now = new Date().toISOString();
  matches.forEach(session => {
    session.status = 'terminated';
    session.termination_reason = req.body?.reason || `Agent ${req.params.agentId} disabled by WardenAI kill switch`;
    session.terminated_at = now;
    session.terminated_by = 'manual';
    session.updated_at = now;
    logAuditEvent({
      organization_id: session.organization_id,
      project_id: session.project_id,
      session_id: session.id,
      event_type: 'session.terminated',
      decision: 'TERMINATE',
      reason: session.termination_reason,
      risk_level: 'critical',
      metadata: { agent_id: req.params.agentId, kill_all_agent_sessions: true }
    });
  });
  await db.persist();
  res.json({ success: true, agent_id: req.params.agentId, terminated_sessions: matches.length });
});

controlPlaneRouter.get('/v1/integrations', requireAuth, (req: Request, res: Response) => {
  const now = new Date().toISOString();
  const integrations: IntegrationStatus[] = [
    { provider: 'gmail', connected: !!process.env.GMAIL_ACCESS_TOKEN, configured: !!process.env.GMAIL_ACCESS_TOKEN, mode: 'credential_proxy', protected_actions: ['search', 'read', 'send'], last_checked_at: now },
    { provider: 'stripe', connected: false, configured: !!process.env.STRIPE_SECRET_KEY, mode: 'planned', protected_actions: ['charge', 'refund', 'cancel'], last_checked_at: now },
    { provider: 'github', connected: false, configured: false, mode: 'planned', protected_actions: ['merge', 'delete', 'change_permissions'], last_checked_at: now },
    { provider: 'vercel', connected: false, configured: false, mode: 'planned', protected_actions: ['deploy', 'promote', 'rollback'], last_checked_at: now },
    { provider: 'google_drive', connected: false, configured: false, mode: 'planned', protected_actions: ['write', 'share', 'delete'], last_checked_at: now },
    { provider: 'google_calendar', connected: false, configured: false, mode: 'planned', protected_actions: ['create', 'update', 'delete'], last_checked_at: now }
  ];
  res.json(integrations);
});

controlPlaneRouter.get('/v1/credentials', requireAuth, requireRole(['owner', 'admin']), (req: Request, res: Response) => {
  res.json([
    { provider: 'gmail', configured: !!process.env.GMAIL_ACCESS_TOKEN, secret_exposed: false, storage: 'server environment', access: 'WardenAI execution gateway only' },
    { provider: 'stripe', configured: !!process.env.STRIPE_SECRET_KEY, secret_exposed: false, storage: 'server environment', access: 'WardenAI only (gateway planned)' },
    { provider: 'jwt', configured: !!process.env.JWT_SECRET, secret_exposed: false, storage: 'server environment', access: 'authentication service only' }
  ]);
});
