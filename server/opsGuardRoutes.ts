import { Router, Request, Response, NextFunction } from 'express';
import { db } from './db';
import { authenticate, logAuditEvent } from './auth';

export const opsGuardRouter = Router();
opsGuardRouter.use(authenticate);

const OPS_AGENT_ID = 'creignificent_ops_followup_v1';
const DAILY_SEND_CAP = 20;

function currentOrgId(req: Request): string | undefined {
  return req.auth?.organization?.id || req.auth?.apiKey?.organization_id;
}

function isToday(iso?: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getUTCFullYear() === now.getUTCFullYear()
    && d.getUTCMonth() === now.getUTCMonth()
    && d.getUTCDate() === now.getUTCDate();
}

opsGuardRouter.post('/v1/admit', (req: Request, res: Response, next: NextFunction) => {
  const agentId = String(req.body?.agent_id || '').trim();
  const tool = String(req.body?.tool || '').toLowerCase().trim();
  const action = String(req.body?.action || '').toLowerCase().trim();

  if (agentId !== OPS_AGENT_ID || tool !== 'gmail' || action !== 'send') {
    next();
    return;
  }

  const orgId = currentOrgId(req);
  if (!orgId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const store = db.get();
  const sentOrReservedToday = store.actions.filter(a =>
    a.organization_id === orgId
    && a.agent_id === OPS_AGENT_ID
    && a.tool.toLowerCase() === 'gmail'
    && a.action.toLowerCase() === 'send'
    && a.admit_decision !== 'DENY'
    && isToday(a.admitted_at)
  ).length;

  if (sentOrReservedToday >= DAILY_SEND_CAP) {
    logAuditEvent({
      organization_id: orgId,
      project_id: req.body?.project_id,
      session_id: req.body?.session_id,
      event_type: 'session.admit_deny',
      decision: 'DENY',
      reason: `Creignificent Ops Agent daily Gmail send cap reached (${DAILY_SEND_CAP}/day).`,
      risk_level: 'high',
      metadata: { agent_id: OPS_AGENT_ID, daily_send_cap: DAILY_SEND_CAP, counted_today: sentOrReservedToday }
    });

    res.status(403).json({
      decision: 'DENY',
      reason: `Daily send cap reached. The Ops Agent may request at most ${DAILY_SEND_CAP} Gmail sends per day.`,
      rule_id: 'ops_daily_send_cap',
      risk_level: 'high',
      daily_send_cap: DAILY_SEND_CAP,
      used_today: sentOrReservedToday
    });
    return;
  }

  next();
});
