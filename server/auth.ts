/**
 * Warden Authentication & Multi-Tenant RBAC Middleware
 * Creignificent LLC
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db, hashApiKey } from './db';
import type { Organization, OrganizationMember, Role, AuditLog, AuditEventType, RiskLevel } from '../src/types';

function getJwtSecret(): string {
  const configured = process.env.JWT_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production and must be at least 32 characters');
  }
  return configured || 'warden-local-development-secret-change-me-2026';
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  email_verified: boolean;
}

export interface AuthContext {
  user?: AuthenticatedUser;
  organization?: Organization;
  member?: OrganizationMember;
  apiKey?: {
    id: string;
    project_id: string;
    organization_id: string;
    name: string;
  };
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/**
 * Tamper-proof signed session token (HMAC-SHA256).
 */
export function generateToken(payload: { userId: string; email: string; orgId?: string }): string {
  const data = JSON.stringify({
    ...payload,
    exp: Date.now() + 7 * 24 * 3600 * 1000
  });
  const encoded = Buffer.from(data).toString('base64url');
  const signature = crypto.createHmac('sha256', getJwtSecret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyToken(token: string): { userId: string; email: string; orgId?: string } | null {
  try {
    const [encoded, signature] = token.split('.');
    if (!encoded || !signature) return null;

    const expectedSig = crypto.createHmac('sha256', getJwtSecret()).update(encoded).digest('base64url');
    if (!timingSafeStringEqual(signature, expectedSig)) return null;

    const json = Buffer.from(encoded, 'base64url').toString('utf-8');
    const payload = JSON.parse(json);
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Appends persistent audit log record.
 */
export function logAuditEvent(params: {
  organization_id: string;
  project_id?: string;
  user_id?: string;
  user_email?: string;
  session_id?: string;
  action_id?: string;
  event_type: AuditEventType;
  decision?: any;
  reason?: string;
  risk_level?: RiskLevel;
  metadata?: Record<string, any>;
  ip_address?: string;
}): AuditLog {
  const store = db.get();
  const log: AuditLog = {
    id: `aud_${crypto.randomUUID().substring(0, 10)}`,
    timestamp: new Date().toISOString(),
    organization_id: params.organization_id,
    project_id: params.project_id,
    user_id: params.user_id,
    user_email: params.user_email,
    session_id: params.session_id,
    action_id: params.action_id,
    event_type: params.event_type,
    decision: params.decision,
    reason: params.reason,
    risk_level: params.risk_level || 'low',
    metadata: params.metadata,
    ip_address: params.ip_address
  };

  store.audit_logs.unshift(log);
  if (store.audit_logs.length > 2000) store.audit_logs = store.audit_logs.slice(0, 2000);
  void db.persist();
  return log;
}

function isPublicAuthRoute(req: Request): boolean {
  const path = req.path;
  return path === '/v1/auth/login'
    || path === '/v1/auth/signup'
    || path === '/v1/auth/reset-password'
    || path === '/v1/auth/google';
}

/**
 * Authenticates either via user session token or project API key.
 * Fails closed: protected API routes do not receive an anonymous demo identity.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'] as string | undefined;
  const orgHeader = req.headers['x-organization-id'] as string | undefined;

  if (req.path === '/v1/auth/google' && process.env.ENABLE_GOOGLE_LOGIN !== 'true') {
    res.status(403).json({ error: 'Google login is disabled. Set ENABLE_GOOGLE_LOGIN=true only after configuring a verified OAuth flow.' });
    return;
  }

  let token = '';
  if (authHeader?.startsWith('Bearer ')) token = authHeader.substring(7).trim();
  else if (apiKeyHeader) token = apiKeyHeader.trim();

  if (!token) {
    if (isPublicAuthRoute(req)) {
      req.auth = {};
      return next();
    }
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const store = db.get();

  // Project API keys are developer-scoped credentials.
  if (token.startsWith('warden_live_') || token.startsWith('warden_test_')) {
    const hashed = hashApiKey(token);
    const key = store.api_keys.find(k => !k.revoked && timingSafeStringEqual(k.key_hash, hashed));
    if (!key) {
      res.status(401).json({ error: 'Unauthorized: Invalid or revoked API key' });
      return;
    }

    key.last_used_at = new Date().toISOString();
    void db.persist();
    const org = store.organizations.find(o => o.id === key.organization_id);
    req.auth = {
      organization: org,
      apiKey: {
        id: key.id,
        project_id: key.project_id,
        organization_id: key.organization_id,
        name: key.name
      }
    };
    return next();
  }

  const verified = verifyToken(token);
  if (verified) {
    const user = store.users.find(u => u.id === verified.userId);
    if (user) {
      const activeOrgId = orgHeader || verified.orgId || store.members.find(m => m.user_id === user.id)?.organization_id;
      const org = store.organizations.find(o => o.id === activeOrgId);
      const member = org ? store.members.find(m => m.organization_id === org.id && m.user_id === user.id) : undefined;
      req.auth = {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          email_verified: user.email_verified
        },
        organization: org,
        member
      };
      return next();
    }
  }

  res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth?.user && !req.auth?.apiKey) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

/** Tenant isolation guard. */
export function requireOrgAccess(req: Request, res: Response, next: NextFunction): void {
  const targetOrgId = req.params.orgId || req.body?.organization_id || req.query?.organization_id as string;
  const currentOrgId = req.auth?.organization?.id || req.auth?.apiKey?.organization_id;

  if (!currentOrgId) {
    res.status(401).json({ error: 'No active organization context found' });
    return;
  }

  if (targetOrgId && targetOrgId !== currentOrgId) {
    logAuditEvent({
      organization_id: currentOrgId,
      user_id: req.auth?.user?.id,
      user_email: req.auth?.user?.email,
      event_type: 'session.policy_violation',
      decision: 'DENY',
      reason: `Cross-tenant access attempt: authenticated for org ${currentOrgId}, tried to access org ${targetOrgId}`,
      risk_level: 'critical',
      metadata: { target_org: targetOrgId }
    });
    res.status(403).json({ error: 'Forbidden: Access denied to foreign organization resource' });
    return;
  }

  next();
}

/** Role-Based Access Control guard. API keys never inherit admin/owner authority. */
export function requireRole(allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.auth?.apiKey) {
      if (allowedRoles.includes('developer')) return next();
      res.status(403).json({ error: 'Forbidden: API keys are developer-scoped and cannot perform owner/admin operations' });
      return;
    }

    const member = req.auth?.member;
    if (!member || !allowedRoles.includes(member.role)) {
      res.status(403).json({
        error: `Forbidden: Insufficient privileges. Required role: [${allowedRoles.join(', ')}], current role: [${member?.role || 'none'}]`
      });
      return;
    }
    next();
  };
}
