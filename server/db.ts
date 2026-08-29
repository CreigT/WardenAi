/**
 * Warden Production Database Layer
 * Thread-safe persistent file-backed database for Multi-Tenant SaaS
 * Creignificent LLC
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
  UsageRecord,
  Role,
  Environment
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
  user_passwords: Record<string, string>; // user_id -> salt:hash
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'warden-data.json');

// Memory cache with disk persistence
let dbState: DatabaseSchema | null = null;
let writeQueue: Promise<void> = Promise.resolve();

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')): string {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, originalHash] = storedHash.split(':');
  if (!salt || !originalHash) return false;
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(originalHash));
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function generateApiKey(projectId: string, organizationId: string, name: string): { apiKey: ApiKey; rawKey: string } {
  const randomBytes = crypto.randomBytes(24).toString('hex');
  const rawKey = `warden_live_${randomBytes}`;
  const keyPrefix = rawKey.substring(0, 16) + '...';
  const keyHash = hashApiKey(rawKey);

  const apiKey: ApiKey = {
    id: `key_${crypto.randomUUID().substring(0, 8)}`,
    project_id: projectId,
    organization_id: organizationId,
    name,
    key_prefix: keyPrefix,
    key_hash: keyHash,
    created_at: new Date().toISOString(),
    revoked: false
  };

  return { apiKey, rawKey };
}

function getInitialSeedData(): DatabaseSchema {
  const now = new Date().toISOString();
  const userId = 'usr_creignificent_admin';
  const orgId = 'org_creignificent';
  const projectId = 'proj_autonomous_core';
  const stagingProjectId = 'proj_sandbox_staging';
  const policyId = 'pol_enterprise_guard';
  const stagingPolicyId = 'pol_sandbox_guard';
  const subId = 'sub_enterprise_creig';

  const defaultRules = {
    allowed_tools: ['file_read', 'search_docs', 'calculate', 'summarize_text', 'query_vector_db'],
    blocked_tools: ['bash', 'shell_exec', 'file_delete', 'drop_database', 'raw_sql_exec', 'send_untrusted_email'],
    allowed_paths: ['/app/data/*', './src/docs/*', '/workspace/public/*', './assets/*'],
    blocked_paths: ['.env*', '**/credentials*', '/etc/*', '/root/*', '~/.ssh/*', '**/*secret*', '**/id_rsa*'],
    allowed_domains: ['api.creignificent.com', 'api.github.com', 'huggingface.co', '*.openai.com', '*.anthropic.com'],
    blocked_domains: ['*darkweb*', 'internal-admin.lan', '169.254.169.254', 'localhost'],
    allow_env_access: false,
    blocked_env_vars: ['GEMINI_API_KEY', 'STRIPE_SECRET_KEY', 'AWS_SECRET_ACCESS_KEY', 'DATABASE_URL', 'JWT_SECRET'],
    allow_shell: false,
    blocked_shell_commands: ['rm', 'sudo', 'chmod', 'curl', 'wget', 'cat /etc/passwd'],
    sensitive_data_patterns: [
      'sk-[a-zA-Z0-9]{32,}',
      'AIza[0-9A-Za-z-_]{35}',
      'ghp_[a-zA-Z0-9]{36}',
      'AKIA[0-9A-Z]{16}',
      '-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----'
    ],
    max_actions_per_session: 50,
    max_failures_per_session: 3,
    auto_terminate_on_violation: true,
    auto_terminate_on_max_failures: true
  };

  const { apiKey: defaultKey } = generateApiKey(projectId, orgId, 'Production Agent Runner');
  // Store known test key hash for testing
  const testKeyHash = hashApiKey('warden_live_test_key_creignificent_2026');
  const demoApiKey: ApiKey = {
    id: 'key_demo_test_01',
    project_id: projectId,
    organization_id: orgId,
    name: 'Test SDK Runner',
    key_prefix: 'warden_live_test_key...',
    key_hash: testKeyHash,
    created_at: now,
    revoked: false
  };

  return {
    users: [
      {
        id: userId,
        email: 'CreigTerrence@gmail.com',
        name: 'Creig Terrence (Creignificent)',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&auto=format&fit=crop&q=80',
        email_verified: true,
        created_at: now,
        updated_at: now
      },
      {
        id: 'usr_dev_alex',
        email: 'alex.chen@creignificent.com',
        name: 'Alex Chen',
        email_verified: true,
        created_at: now,
        updated_at: now
      }
    ],
    user_passwords: {
      [userId]: hashPassword('Warden2026!Secure'),
      ['usr_dev_alex']: hashPassword('Developer2026!')
    },
    organizations: [
      {
        id: orgId,
        name: 'Creignificent LLC',
        slug: 'creignificent',
        created_by: userId,
        created_at: now,
        updated_at: now,
        subscription_id: subId
      }
    ],
    members: [
      {
        id: 'mem_01',
        organization_id: orgId,
        user_id: userId,
        user_email: 'CreigTerrence@gmail.com',
        user_name: 'Creig Terrence (Creignificent)',
        role: 'owner',
        joined_at: now
      },
      {
        id: 'mem_02',
        organization_id: orgId,
        user_id: 'usr_dev_alex',
        user_email: 'alex.chen@creignificent.com',
        user_name: 'Alex Chen',
        role: 'developer',
        joined_at: now
      }
    ],
    projects: [
      {
        id: projectId,
        organization_id: orgId,
        name: 'Autonomous Agent Core',
        description: 'Production AI reasoning and tool-calling cluster',
        environment: 'production',
        active_policy_id: policyId,
        created_at: now,
        updated_at: now
      },
      {
        id: stagingProjectId,
        organization_id: orgId,
        name: 'Sandbox Agent Cluster',
        description: 'Development environment for staging agent behaviors',
        environment: 'staging',
        active_policy_id: stagingPolicyId,
        created_at: now,
        updated_at: now
      }
    ],
    policies: [
      {
        id: policyId,
        project_id: projectId,
        organization_id: orgId,
        name: 'Strict Enterprise Defense Policy',
        description: 'Zero-trust tool guardrails, filesystem isolation, and prompt-injection containment',
        enabled: true,
        rules: defaultRules,
        version: 1,
        created_at: now,
        updated_at: now
      },
      {
        id: stagingPolicyId,
        project_id: stagingProjectId,
        organization_id: orgId,
        name: 'Staging Defense Policy',
        description: 'Staging security boundary with sandbox tools',
        enabled: true,
        rules: {
          ...defaultRules,
          max_actions_per_session: 100,
          max_failures_per_session: 5
        },
        version: 1,
        created_at: now,
        updated_at: now
      }
    ],
    sessions: [
      {
        id: 'sess_prod_agent_772',
        project_id: projectId,
        organization_id: orgId,
        agent_id: 'agent_doc_summarizer_v3',
        name: 'Knowledge Base Ingestion Worker',
        status: 'active',
        action_count: 14,
        failure_count: 0,
        created_at: new Date(Date.now() - 3600000).toISOString(),
        updated_at: now,
        metadata: { model: 'gemini-2.5-pro', task: 'doc_indexing' }
      },
      {
        id: 'sess_suspicious_rogue_901',
        project_id: projectId,
        organization_id: orgId,
        agent_id: 'agent_crawler_v2',
        name: 'External Web Crawler Worker',
        status: 'terminated',
        action_count: 2,
        failure_count: 1,
        termination_reason: 'Policy Violation: Attempted access to blocked path /.env.example',
        terminated_at: new Date(Date.now() - 7200000).toISOString(),
        terminated_by: 'policy',
        created_at: new Date(Date.now() - 7500000).toISOString(),
        updated_at: new Date(Date.now() - 7200000).toISOString(),
        metadata: { threat_level: 'critical', trigger: 'path_traversal' }
      }
    ],
    actions: [
      {
        id: 'act_01_allow',
        session_id: 'sess_prod_agent_772',
        project_id: projectId,
        organization_id: orgId,
        agent_id: 'agent_doc_summarizer_v3',
        tool: 'file_read',
        action: 'read_document',
        target: '/app/data/quarterly_report.pdf',
        admit_decision: 'ALLOW',
        admit_reason: 'Target path and tool comply with Strict Enterprise Defense Policy',
        admit_rule_id: 'rule_allowed_paths',
        admit_risk_level: 'low',
        admitted_at: new Date(Date.now() - 3500000).toISOString(),
        review_decision: 'CONTINUE',
        review_reason: 'Tool execution clean; no sensitive data leaked',
        review_risk_level: 'low',
        reviewed_at: new Date(Date.now() - 3490000).toISOString(),
        tool_result: { bytes_read: 14200, status: 'ok' }
      }
    ],
    audit_logs: [
      {
        id: 'aud_seed_01',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        organization_id: orgId,
        project_id: projectId,
        session_id: 'sess_suspicious_rogue_901',
        action_id: 'act_rogue_01',
        event_type: 'session.policy_violation',
        decision: 'DENY',
        reason: 'Attempted access to blocked path: /.env.example',
        risk_level: 'critical',
        metadata: { tool: 'file_read', target: '/.env.example', agent: 'agent_crawler_v2' }
      },
      {
        id: 'aud_seed_02',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        organization_id: orgId,
        project_id: projectId,
        session_id: 'sess_suspicious_rogue_901',
        event_type: 'session.terminated',
        decision: 'TERMINATE',
        reason: 'Automated Kill Switch triggered by policy auto_terminate_on_violation',
        risk_level: 'critical',
        metadata: { auto_kill: true }
      },
      {
        id: 'aud_seed_03',
        timestamp: new Date(Date.now() - 3500000).toISOString(),
        organization_id: orgId,
        project_id: projectId,
        session_id: 'sess_prod_agent_772',
        action_id: 'act_01_allow',
        event_type: 'session.admit_allow',
        decision: 'ALLOW',
        reason: 'Verified against whitelist',
        risk_level: 'low'
      }
    ],
    api_keys: [defaultKey, demoApiKey],
    subscriptions: [
      {
        id: subId,
        organization_id: orgId,
        plan: 'business',
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        limits: {
          monthly_actions: 1000000,
          max_projects: 50,
          max_team_members: 25,
          custom_policies: true,
          advanced_threat_detection: true,
          priority_kill_switch: true,
          audit_log_retention_days: 365
        }
      }
    ],
    usage_records: [
      {
        id: 'use_cur_month',
        organization_id: orgId,
        project_id: projectId,
        period: new Date().toISOString().substring(0, 7),
        admit_requests: 4820,
        admit_allows: 4792,
        admit_denies: 28,
        review_requests: 4790,
        sessions_created: 142,
        sessions_terminated: 3,
        threat_violations: 28,
        updated_at: now
      }
    ]
  };
}

export function initDb(): DatabaseSchema {
  if (dbState) return dbState;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      dbState = JSON.parse(raw);
      console.log('⚡ [Warden DB] Loaded database state from disk');
      return dbState!;
    } catch (err) {
      console.error('⚠️ [Warden DB] Error reading disk database, reinitializing seed data:', err);
    }
  }

  dbState = getInitialSeedData();
  saveDbSync();
  console.log('✨ [Warden DB] Initialized fresh multi-tenant database for Creignificent LLC');
  return dbState;
}

function saveDbSync(): void {
  if (!dbState) return;
  try {
    const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(dbState, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('❌ [Warden DB] Error saving to disk:', err);
  }
}

export function saveDb(): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    saveDbSync();
  });
  return writeQueue;
}

export const db = {
  get: () => initDb(),
  persist: () => saveDb(),
  hashPassword,
  verifyPassword
};
