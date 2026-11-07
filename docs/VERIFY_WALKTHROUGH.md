# VERIFY Walkthrough — Gmail Send Forces REVIEW

**Goal:** Confirm that a sensitive action cannot execute without human approval and that the decision is recorded.

## Steps
1. Start the local server (`npm run dev`) with a valid `GMAIL_ACCESS_TOKEN` in `.env`.
2. Create a session and obtain an agent token or project API key.
3. Call `POST /api/v1/admit` with an action of type `gmail.send`.
4. Observe the response: decision must be `REVIEW`. The action must not execute.
5. As owner/admin, call `POST /api/v1/reviews/:actionId` to approve.
6. Call `POST /api/v1/execute` for the approved action.
7. Check `GET /api/v1/audit-logs`. Confirm entries exist for the admit (REVIEW), the approval, and the execution.

## Pass Criteria
- No execution occurs before approval.
- Audit log contains the REVIEW decision, the human approval, and the execution result.
- The raw Gmail token never appears in any response.

## Fail Criteria
- Action executes without approval.
- Missing audit entries.
- Token leakage in any response.

This is a single verification step. Repeat the pattern for DENY paths and kill-switch before expanding scope.
