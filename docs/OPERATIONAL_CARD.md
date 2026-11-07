# WardenAI Operational Card
**Zero-trust execution control plane for autonomous AI agents**  
Sponsored by CREIGNIFICENT LLC · Status: Prototype with live Gmail gateway

## Purpose
Decide what an autonomous agent may do before any privileged tool executes. Keep provider credentials inside the control plane. Record every decision. Terminate sessions on demand.

## Trust Boundaries
- Agents never receive production credentials.
- Every privileged action must pass through WardenAI.
- Admission returns exactly one of: ALLOW | REVIEW | DENY.
- REVIEW cannot execute until an owner/admin approves it.
- DENY is blocked.
- Server-side gateway performs the actual provider call.
- All admit, review, credential access, execution, and kill events are audited.

## Core Flow
Agent → POST /api/v1/admit → Policy decision → (Human review if REVIEW) → POST /api/v1/execute → Audit log  
Kill: POST /api/v1/sessions/:sessionId/terminate or POST /api/v1/agents/:agentId/kill

## Current Enforcement (v1)
- Live gateway: Gmail (search/list/read allowed by policy; send forced to REVIEW)
- Credentials: GMAIL_ACCESS_TOKEN read only by server; never returned to agents
- API keys: developer-scoped; cannot approve REVIEW actions
- Database: file-backed (ephemeral on Vercel /tmp). Not suitable for real tenant data or durable audit.

## Explicit Non-Goals (current)
- Does not automatically intercept external agents or tools
- Does not persist identity, policy, or audit across restarts on Vercel
- Does not support production multi-tenant use until durable store + encrypted credential store exist

## Verification Points
1. Agent cannot obtain upstream token via any API response.
2. gmail.send always returns REVIEW and blocks until approved.
3. Kill endpoint terminates active session and is written to audit log.
4. API key cannot approve a REVIEW action.

## Next Secure Step
Replace file-backed store with durable database (Postgres/Neon/Turso) and move long-lived OAuth tokens to encrypted secret store before any real tenant use.
