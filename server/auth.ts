/**
 * Warden Authentication & Multi-Tenant RBAC Middleware
 * Creignificent LLC
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db, hashApiKey } from './db';
import type { User, Organization, OrganizationMember, Role, AuditLog, AuditEventType, RiskLevel } from '../src/types';

const JWT_SECRET = process.env.JWT_SECRET || 'warden-enterprise-jwt-secret-key-creignificent';

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
 * Simple, tamper-proof signed session token (HMAC-SHA256)
 */
export function generateToken(payload: { userId: string; email: string; orgId?: string }): string {
  const data = JSON.stringify({
    ...payload,
    exp: Date.now() + 7 * 24 * 3600 * 1000 // 7 days
  });
  const encoded = Buffer.from(data).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyToken(token: string): { userId: string; email: string; orgId?: string } | null {
  try {
    const [encoded, signature] = token.split('.');
    if (!encoded || !signature) return null;

    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(encoded).digest('base64url');
    if (signature !== expectedSig) return null;

    const json = Buffer.from(encoded, 'base64url').toString('utf-8');
    const payload = JSON.parse(json);

    if (payload.exp && payload.exp < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Appends persistent audit log record
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
  // Cap in-memory/file audit log count to a reasonable size if needed
  if (store.audit_logs.length > 2000) {
    store.audit_logs = store.audit_logs.slice(0, 2000);
  }
  db.persist();
  return log;
}

/**
 * Express Middleware: Authenticates either via User JWT Token OR Project API Key
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'] as string | undefined;
  const orgHeader = req.headers['x-organization-id'] as string | undefined;

  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (apiKeyHeader) {
    token = apiKeyHeader.trim();
  }

  if (!token) {
    // Check if demo user fallback is available for playground/public requests
    req.auth = {};
    return next();
  }

  const store = db.get();

  // 1. Check if token is an API key (starts with 'warden_live_' or 'warden_test_')
  if (token.startsWith('warden_live_') || token.startsWith('warden_test_')) {
    const hashed = hashApiKey(token);
    const key = store.api_keys.find(k => k.key_hash === hashed && !k.revoked);

    if (!key) {
      res.status(401).json({ error: 'Unauthorized: Invalid or revoked API key' });
      return;
    }

    // Update key last used timestamp
    key.last_used_at = new Date().toISOString();
    db.persist();

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

  // 2. Otherwise treat as user JWT session token
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

  // Invalid token
  res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
}

/**
 * Strict authentication guard
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth?.user && !req.auth?.apiKey) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

/**
 * Tenant isolation guard: Ensures target resource organization matches user/key organization
 */
export function requireOrgAccess(req: Request, res: Response, next: NextFunction): void {
  const store = db.get();
  const targetOrgId = req.params.orgId || req.body?.organization_id || req.query?.organization_id as string;

  const currentOrgId = req.auth?.organization?.id || req.auth?.apiKey?.organization_id;

  if (!currentOrgId) {
    res.status(401).json({ error: 'No active organization context found' });
    return;
  }

  if (targetOrgId && targetOrgId !== currentOrgId) {
    // Cross-tenant access attempted!
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

/**
 * Role-Based Access Control (RBAC) Guard
 */
export function requireRole(allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    // API keys with project scopes act as 'developer'
    if (req.auth?.apiKey) {
      if (allowedRoles.includes('developer') || allowedRoles.includes('admin') || allowedRoles.includes('viewer')) {
        return next();
      }
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
