# WardenAI

**Zero-trust security control plane for autonomous AI agents.**  
Built for **Creignificent LLC**.

> Agent → WardenAI → Policy Decision → Human Review if Needed → Real Tool Execution → Audit Log

WardenAI decides what autonomous agents may do, requires human approval for sensitive actions, keeps upstream credentials inside the trusted control plane, records security-relevant activity, and can terminate compromised agent sessions.

## Security model

- Agents do **not** receive production provider credentials.
- Agents request privileged actions through WardenAI.
- WardenAI returns one of three admission decisions: `ALLOW`, `REVIEW`, or `DENY`.
- `REVIEW` actions cannot execute until an owner/admin approves them.
- `DENY` actions cannot execute.
- WardenAI performs supported provider calls from the server-side execution gateway.
- Every admit, review, credential access, execution result, and kill-switch event is written to the audit log.

## Console

The application is organized around the enforcement lifecycle:

- **Agents** — observed autonomous agents and kill controls
- **Policies** — tool, path, domain, session, and sensitive-data rules
- **Sessions** — active and terminated agent sessions
- **Reviews** — human approval queue for privileged actions
- **Integrations** — credential-isolated provider gateways
- **Audit Logs** — request, policy, review, execution, and kill-switch history
- **Credentials** — configuration status only; raw secrets are never displayed
- **Kill Switch** — terminate a session or all active sessions for an agent

## v1 live execution gateway

The first credential proxy is **Gmail**.

Supported server-side actions:

- `gmail.search` / `gmail.list` — allowed when policy permits
- `gmail.read` — allowed when policy permits
- `gmail.send` — automatically classified as `REVIEW`

The Gmail access token is read only by the WardenAI server from `GMAIL_ACCESS_TOKEN`. It is never returned through the agent API.

Other integrations currently appear in the console as planned gateways: Stripe, GitHub, Vercel, Google Drive, and Google Calendar.

## Core API

```text
POST /api/v1/sessions
POST /api/v1/admit
GET  /api/v1/reviews
POST /api/v1/reviews/:actionId
POST /api/v1/execute
POST /api/v1/sessions/:sessionId/terminate
POST /api/v1/agents/:agentId/kill
GET  /api/v1/integrations
GET  /api/v1/credentials
GET  /api/v1/audit-logs
GET  /api/health
```

Protected routes require either a WardenAI user session token or an authorized project API key. API keys are developer-scoped and cannot perform owner/admin approval operations.

## Local development

```bash
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:3000`.

Local-only seed accounts:

| Email | Environment variable | Local fallback |
|---|---|---|
| `admin@creignificent.local` | `DEMO_ADMIN_PASSWORD` | `ChangeMe-LocalOnly-2026!` |
| `developer@creignificent.local` | `DEMO_DEV_PASSWORD` | `ChangeMe-DevOnly-2026!` |

Do not expose a deployment using the local fallback passwords.

## Production environment

Set these in Vercel before using authentication or sharing the deployment:

```text
JWT_SECRET=32+ random characters
DEMO_ADMIN_PASSWORD=a strong unique password
DEMO_DEV_PASSWORD=a strong unique password
APP_URL=https://your-domain.example
NODE_ENV=production
```

For the Gmail gateway:

```text
GMAIL_ACCESS_TOKEN=server-side OAuth token
```

Optional/future integrations use their own server-side secrets such as Stripe credentials.

## Vercel

`vercel.json` builds the Vite frontend and `api/[...path].ts` exports the Express API as a Vercel Function.

Important: the current demo database is file-backed. On Vercel it uses `/tmp`, which is **ephemeral**. This is sufficient for UI/API validation but is not acceptable for real tenant identity, policy, approval, or audit persistence.

Before production customer use, replace the file layer with a durable database such as Postgres/Neon/Turso and move long-lived OAuth credentials to an encrypted secret/credential store.

## Current production boundary

WardenAI now contains a real server-side enforcement path for the Gmail gateway. It does **not** yet force unrelated external agents or tools to route through WardenAI automatically. To receive zero-trust enforcement, agents must be integrated so privileged calls go through the WardenAI API and do not possess upstream credentials themselves.

**Sponsored by CREIGNIFICENT LLC.**
