/**
 * Warden AI-Agent Security Control Plane
 * Types & Schema Definitions
 * Creignificent LLC
 */

export type Role = 'owner' | 'admin' | 'developer' | 'viewer';

export type Environment = 'development' | 'staging' | 'production';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  subscription_id: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  role: Role;
  joined_at: string;
}

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  environment: Environment;
  active_policy_id?: string;
  created_at: string;
  updated_at: string;
}

export interface PolicyRules {
  allowed_tools: string[];
  blocked_tools: string[];
  allowed_paths: string[];
  blocked_paths: string[];
  allowed_domains: string[];
  blocked_domains: string[];
  allow_env_access: boolean;
  blocked_env_vars: string[];
  allow_shell: boolean;
  blocked_shell_commands: string[];
  sensitive_data_patterns: string[];
  max_actions_per_session: number;
  max_failures_per_session: number;
  auto_terminate_on_violation: boolean;
  auto_terminate_on_max_failures: boolean;
}

export interface Policy {
  id: string;
  project_id: string;
  organization_id: string;
  name: string;
  description: string;
  enabled: boolean;
  rules: PolicyRules;
  version: number;
  created_at: string;
  updated_at: string;
}

export type SessionStatus = 'active' | 'completed' | 'terminated' | 'failed';

export interface AgentSession {
  id: string;
  project_id: string;
  organization_id: string;
  agent_id: string;
  name: string;
  status: SessionStatus;
  action_count: number;
  failure_count: number;
  termination_reason?: string;
  terminated_at?: string;
  terminated_by?: 'policy' | 'manual' | 'api';
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export type Decision = 'ALLOW' | 'DENY';
export type ReviewDecision = 'CONTINUE' | 'WARN' | 'TERMINATE';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AgentAction {
  id: string;
  session_id: string;
  project_id: string;
  organization_id: string;
  agent_id: string;
  tool: string;
  action: string;
  target?: string;
  arguments?: Record<string, any>;
  admit_decision: Decision;
  admit_reason: string;
  admit_rule_id?: string;
  admit_risk_level: RiskLevel;
  admitted_at: string;
  review_decision?: ReviewDecision;
  review_reason?: string;
  review_risk_level?: RiskLevel;
  reviewed_at?: string;
  tool_result?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export type AuditEventType =
  | 'auth.signup'
  | 'auth.login'
  | 'auth.password_reset'
  | 'policy.created'
  | 'policy.updated'
  | 'policy.deleted'
  | 'api_key.created'
  | 'api_key.revoked'
  | 'session.created'
  | 'session.admit_allow'
  | 'session.admit_deny'
  | 'session.review_continue'
  | 'session.review_warn'
  | 'session.review_terminate'
  | 'session.policy_violation'
  | 'session.terminated'
  | 'billing.subscription_updated'
  | 'team.member_invited'
  | 'team.member_removed'
  | 'team.role_changed'
  | 'project.created'
  | 'project.updated';

export interface AuditLog {
  id: string;
  timestamp: string;
  organization_id: string;
  project_id?: string;
  user_id?: string;
  user_email?: string;
  session_id?: string;
  action_id?: string;
  event_type: AuditEventType;
  decision?: Decision | ReviewDecision;
  reason?: string;
  risk_level?: RiskLevel;
  metadata?: Record<string, any>;
  ip_address?: string;
}

export interface ApiKey {
  id: string;
  project_id: string;
  organization_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  created_at: string;
  last_used_at?: string;
  expires_at?: string;
  revoked: boolean;
}

export type SubscriptionPlan = 'developer' | 'pro' | 'business';

export interface PlanLimits {
  monthly_actions: number;
  max_projects: number;
  max_team_members: number;
  custom_policies: boolean;
  advanced_threat_detection: boolean;
  priority_kill_switch: boolean;
  audit_log_retention_days: number;
}

export interface Subscription {
  id: string;
  organization_id: string;
  plan: SubscriptionPlan;
  status: 'active' | 'trialing' | 'past_due' | 'canceled';
  current_period_start: string;
  current_period_end: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  limits: PlanLimits;
}

export interface UsageRecord {
  id: string;
  organization_id: string;
  project_id: string;
  period: string; // YYYY-MM
  admit_requests: number;
  admit_allows: number;
  admit_denies: number;
  review_requests: number;
  sessions_created: number;
  sessions_terminated: number;
  threat_violations: number;
  updated_at: string;
}

// API DTOs
export interface AdmitRequest {
  organization_id?: string;
  project_id: string;
  session_id: string;
  agent_id: string;
  tool: string;
  action: string;
  target?: string;
  arguments?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface AdmitResponse {
  decision: Decision;
  reason: string;
  policy_id: string;
  rule_id: string;
  risk_level: RiskLevel;
  timestamp: string;
  action_id: string;
  session_status: SessionStatus;
}

export interface ReviewRequest {
  organization_id?: string;
  project_id?: string;
  session_id: string;
  action_id: string;
  tool_result?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ReviewResponse {
  decision: ReviewDecision;
  reason: string;
  risk_level: RiskLevel;
  timestamp: string;
  session_status: SessionStatus;
}

export interface TerminateSessionRequest {
  reason: string;
}

export interface TerminateSessionResponse {
  success: boolean;
  session_id: string;
  status: SessionStatus;
  termination_reason: string;
  terminated_at: string;
}

export interface TestResultItem {
  id: string;
  name: string;
  description: string;
  status: 'passed' | 'failed' | 'running' | 'pending';
  duration_ms?: number;
  details?: string;
  error?: string;
  timestamp?: string;
}
