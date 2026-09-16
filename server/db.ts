/**
 * WardenAI database layer.
 * File-backed for local/demo use; Vercel uses /tmp and is intentionally ephemeral.
 * Replace this layer with Postgres/Neon/Turso before storing real tenant state.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  User,
  Organization,
  OrganizationMember,
  Project,
  Policy,
  AgentSession,
  AgentAction,
  AuditLog,
  ApiKey,
  Subscription,
  UsageRecord
} from '../src/types';

interface DatabaseSchema {
  users: User[];
  organizations: Organization[];
  members: OrganizationMember[];
  projects: Project[];
  policies: Policy[];
  sessions: AgentSession[];
  actions: AgentAction[];
  audit_logs: AuditLog[];
  api_keys: ApiKey[];
  subscriptions: Subscription[];
  usage_records: UsageRecord[];
  user_passwords: Record<string, string>;
}

const DATA_DIR = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'warden-data.json');
const PBKDF2_ITERATIONS = 210_000;

let dbState: DatabaseSchema | null = null;
let writeQueue: Promise<void> = Promise.resolve();

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')): string {
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
  return `pbkdf2_sha512$${PBKDF2_ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [scheme, iterationsRaw, salt, originalHash] = storedHash.split('$');
    if (scheme !== 'pbkdf2_sha512' || !iterationsRaw || !salt || !originalHash) return false;
    const iterations = Number(iterationsRaw);
    if (!Number.isFinite(iterations) || iterations < 100_000) return false;
    const derived = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
    const a = Buffer.from(derived, 'hex');
    const b = Buffer.from(originalHash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function generateApiKey(projectId: string, organizationId: string, name: string): { apiKey: ApiKey; rawKey: string } {
  const randomBytes = crypto.randomBytes(24).toString('hex');
  const rawKey = `warden_live_${randomBytes}`;
  const apiKey: ApiKey = {
    id: `key_${crypto.randomUUID().substring(0, 8)}`,
    project_id: projectId,
    organization_id: organizationId,
    name,
    key_prefix: rawKey.substring(0, 16) + '...',
    key_hash: hashApiKey(rawKey),
    created_at: new Date().toISOString(),
    revoked: false
  };
  return { apiKey, rawKey };
}

function getInitialSeedData(): DatabaseSchema {
  const now = new Date().toISOString();
  const adminId = 'usr_local_admin';
  const devId = 'usr_local_developer';
  const orgId = 'org_creignificent';
  const projectId = 'proj_warden_core';
  const policyId = 'pol_zero_trust_v1';
  const subscriptionId = 'sub_local_demo';

  const adminPassword = process.env.DEMO_ADMIN_PASSWORD || 'ChangeMe-LocalOnly-2026!';
  const devPassword = process.env.DEMO_DEV_PASSWORD || 'ChangeMe-DevOnly-2026!';

  if (process.env.NODE_ENV === 'production' && (!process.env.DEMO_ADMIN_PASSWORD || !process.env.DEMO_DEV_PASSWORD)) {
    throw new Error('DEMO_ADMIN_PASSWORD and DEMO_DEV_PASSWORD must be set in production');
  }

  const policy: Policy = {
    id: policyId,
    project_id: projectId,
    organization_id: orgId,
    name: 'WardenAI Zero-Trust Enforcement Policy',
    description: 'Default v1 guardrails: explicit allowlist, human review for privileged actions, hard-deny boundaries, and kill-switch enforcement.',
    enabled: true,
    rules: {
      allowed_tools: ['gmail', 'file_read', 'search_docs', 'calculate', 'summarize_text', 'query_vector_db'],
      blocked_tools: ['bash', 'shell_exec', 'file_delete', 'drop_database', 'raw_sql_exec', 'credential_export'],
      review_tools: ['gmail'],
      review_actions: ['send', 'delete', 'publish', 'deploy', 'merge', 'refund', 'charge', 'pay', 'transfer'],
      allowed_paths: ['/app/data/*', './src/docs/*', '/workspace/public/*', './assets/*'],
      blocked_paths: ['.env*', '**/credentials*', '/etc/*', '/root/*', '~/.ssh/*', '**/*secret*', '**/id_rsa*'],
      allowed_domains: ['gmail.googleapis.com', 'api.github.com', 'api.stripe.com', '*.vercel.com'],
      blocked_domains: ['169.254.169.254', 'localhost', 'internal-admin.lan'],
      allow_env_access: false,
      blocked_env_vars: ['GMAIL_ACCESS_TOKEN', 'STRIPE_SECRET_KEY', 'JWT_SECRET', 'DATABASE_URL'],
      allow_shell: false,
      blocked_shell_commands: ['rm', 'sudo', 'chmod', 'curl', 'wget', 'cat /etc/passwd'],
      sensitive_data_patterns: [
        'sk-[a-zA-Z0-9]{24,}',
        'AIza[0-9A-Za-z-_]{35}',
        'ghp_[a-zA-Z0-9]{36}',
        'AKIA[0-9A-Z]{16}',
        '-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----'
      ],
      max_actions_per_session: 50,
      max_failures_per_session: 3,
      auto_terminate_on_violation: true,
      auto_terminate_on_max_failures: true
    },
    version: 1,
    created_at: now,
    updated_at: now
  };

  const users: User[] = [
    { id: adminId, email: 'admin@creignificent.local', name: 'WardenAI Administrator', email_verified: true, created_at: now, updated_at: now },
    { id: devId, email: 'developer@creignificent.local', name: 'WardenAI Developer', email_verified: true, created_at: now, updated_at: now }
  ];

  const organization: Organization = {
    id: orgId,
    name: 'Creignificent LLC',
    slug: 'creignificent',
    created_by: adminId,
    created_at: now,
    updated_at: now,
    subscription_id: subscriptionId
  };

  const members: OrganizationMember[] = [
    { id: 'mem_local_admin', organization_id: orgId, user_id: adminId, user_email: users[0].email, user_name: users[0].name, role: 'owner', joined_at: now },
    { id: 'mem_local_dev', organization_id: orgId, user_id: devId, user_email: users[1].email, user_name: users[1].name, role: 'developer', joined_at: now }
  ];

  const project: Project = {
    id: projectId,
    organization_id: orgId,
    name: 'Autonomous Agent Core',
    description: 'Agent → WardenAI → Policy → Human Review → Execution → Audit',
    environment: 'production',
    active_policy_id: policyId,
    created_at: now,
    updated_at: now
  };

  const sampleSession: AgentSession = {
    id: 'sess_demo_guarded',
    project_id: projectId,
    organization_id: orgId,
    agent_id: 'agent_demo_assistant',
    name: 'Guarded Demo Agent',
    status: 'active',
    action_count: 0,
    failure_count: 0,
    created_at: now,
    updated_at: now,
    metadata: { purpose: 'demonstration', credential_access: 'none' }
  };

  const subscription: Subscription = {
    id: subscriptionId,
    organization_id: orgId,
    plan: 'business',
    status: 'active',
    current_period_start: now,
    current_period_end: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    limits: {
      monthly_actions: 100000,
      max_projects: 25,
      max_team_members: 25,
      custom_policies: true,
      advanced_threat_detection: true,
      priority_kill_switch: true,
      audit_log_retention_days: 365
    }
  };

  const usage: UsageRecord = {
    id: 'use_demo_current',
    organization_id: orgId,
    project_id: projectId,
    period: now.substring(0, 7),
    admit_requests: 0,
    admit_allows: 0,
    admit_denies: 0,
    review_requests: 0,
    sessions_created: 1,
    sessions_terminated: 0,
    threat_violations: 0,
    updated_at: now
  };

  return {
    users,
    organizations: [organization],
    members,
    projects: [project],
    policies: [policy],
    sessions: [sampleSession],
    actions: [],
    audit_logs: [],
    api_keys: [],
    subscriptions: [subscription],
    usage_records: [usage],
    user_passwords: {
      [adminId]: hashPassword(adminPassword),
      [devId]: hashPassword(devPassword)
    }
  };
}

export function initDb(): DatabaseSchema {
  if (dbState) return dbState;

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      dbState = JSON.parse(raw);
      console.log(`⚡ [Warden DB] Loaded state from ${DB_FILE}`);
      return dbState!;
    } catch (err) {
      console.error('⚠️ [Warden DB] Could not load state; reinitializing demo seed:', err);
    }
  }

  dbState = getInitialSeedData();
  saveDbSync();
  console.log(process.env.VERCEL
    ? '⚠️ [Warden DB] Using /tmp ephemeral Vercel storage. Configure a durable database before real tenant use.'
    : '✨ [Warden DB] Initialized local demo database.');
  return dbState;
}

function saveDbSync(): void {
  if (!dbState) return;
  try {
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(dbState, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('❌ [Warden DB] Error saving state:', err);
  }
}

export function saveDb(): Promise<void> {
  writeQueue = writeQueue.then(async () => saveDbSync());
  return writeQueue;
}

export const db = {
  get: () => initDb(),
  persist: () => saveDb(),
  hashPassword,
  verifyPassword
};
