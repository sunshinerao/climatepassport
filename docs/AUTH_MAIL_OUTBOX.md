# CP authentication mail outbox

Scope: REGISTER, VERIFY and RESET only. No marketing/notification platform, live worker startup, provider send or database migration was performed.

## Request and worker separation

Public request routes validate input, apply shared database quota and persist an account-independent job before responding. No account lookup, bcrypt, raw credential generation or provider call occurs there. Registration password remains accepted/validated for client compatibility but is neither enqueued nor persisted. The mailbox holder sets the actual password at verification. Job payload contains only locale and allowlisted registration profile fields; no password/hash, link token, code or arbitrary template.

Deduplication is by credential version, kind, normalized address and ten-minute window. Repeated requests in a window reuse the existing job even if terminal; this is not an automatic replay mechanism. A fresh deliberate epoch gets a distinct job. A user request in a later window is a new request, not retrying UNKNOWN delivery. Public acknowledgment says only that eligible instructions will be sent; delivery and even account existence are not disclosed.

The worker checks account eligibility, creates a new self-account only when appropriate with an unusable password placeholder, mints an expiring credential and invokes the existing mail transport. It never overwrites partner PENDING identities or existing passwords. No provider secrets or raw challenge values are persisted in queue rows or diagnostic strings.

## State and recovery

| State | Meaning |
| --- | --- |
| PENDING | Durable queued work; may be claimed after nextAttemptAt |
| PROCESSING | Claimed with unique lease; bounded worker owns the attempt |
| SENT | Provider accepted; mailbox delivery is unconfirmed |
| SKIPPED | Ineligible account, stale request or no-longer-valid epoch/credential |
| FAILED | Explicit rejection, invalid work, or exhausted safe retries |
| UNKNOWN | Send acceptance or crashed-worker outcome cannot be determined; never automatically resent |

Atomic conditional updates claim jobs and fence dispatch. Expired PROCESSING leases become UNKNOWN, never PENDING. Known pre-send failures may retry up to three total claims with bounded backoff; explicit rejection terminates. A timeout, network error, ambiguous acceptance, failed finalization after send or abandoned worker cannot trigger automatic replay. No provider idempotency key support is assumed. Inspect provider records before any separately authorized manual recovery; this implementation exposes no arbitrary replay endpoint.

Credentials are checked for expiration/revocation before dispatch, and stale queued requests are skipped. A credential can expire or be revoked after the final check while a provider request is in flight; transport cannot retract accepted email, but confirmation will reject invalid credentials. Queue status and fixed failureCode are the operational record, not proof of mailbox delivery. Row retention/cleanup needs an approved database policy; no cleanup job is enabled here.

## Controlled invocation and deployment gates

`POST /api/internal/auth-mail-worker` requires a dedicated server-side header credential and accepts only a bounded batch limit. Full protocol and timeout bounds are in `MAIL_TRANSPORT.md`. An external approved scheduler or operator must explicitly invoke it; app startup does not process jobs. No scheduler has been configured. Without a worker, requests remain queued and eventually become stale; this is not a completed delivery chain.

Deployment requires both prepared migrations, generated Prisma client, isolated PostgreSQL concurrency/migration tests, configured credential epoch/code secret/provider settings and worker secret, and an approved scheduler/runtime duration. Monitor queue age, FAILED/UNKNOWN counts and sanitized failure codes. Credentials should be managed outside code; do not put header/provider values into request logs. Actual deployment, real-mail validation and production migration need separate authorization.

`AUTH_MAIL_ROTATION.md` defines coordinated explicit epoch revocation. The database/worker integration plan is in `AUTH_MAIL_INDEPENDENT_REVIEW.md`. All queue/transport tests in this review are mocks, not real PostgreSQL/provider acceptance.
