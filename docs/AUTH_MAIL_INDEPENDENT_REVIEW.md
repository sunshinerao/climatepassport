# Independent review and isolated acceptance plan

Reviewed by an internal agent that did not implement the mail/auth changes. Review is of the actual tracked diff, new helpers, migration and regression tests. No real database connection or mail send.

## Findings and disposition

1. **P1 preregistration password takeover — corrected; code/mock review closed.** Registration previously stored an unverified requester's password, then email verification activated that same password. Verification now requires the mailbox holder to set a password explicitly. The route hashes it; the transaction replaces password and verification state, clears legacy reset fields, and revokes all sessions/bridges/email credentials together. Tests cover absent password, form payload, route hash forwarding, attacker-set initial hash replacement and rollback. Existing PENDING records remain untouched by registration and are not claimable by this flow.
2. **P2 synchronous account/provider response-time branch — corrected in code/mock scope.** Three email request endpoints now uniformly await only durable quota/enqueue work, with no account lookup, bcrypt or provider call. Eligibility and delivery run in a controlled persistent worker. Enqueue failure returns generic 503; acknowledgment never means mail delivery. Login additionally executes a real-or-dummy bcrypt comparison for missing/ineligible users, removing its obvious early-return branch. Database/network timing, historic bcrypt work factors and cross-request workload are not mathematically constant-time; do not claim complete immunity from all timing inference.
3. **HMAC rotation — explicit version revocation implemented.** `AUTH_EMAIL_CREDENTIAL_VERSION` is persisted on both credential and queued request. A deliberate epoch change rejects old code/link without spending attempts and skips old pending jobs; dedupe includes the epoch so a new request is not swallowed by an old job. Secret-only rotation still does not revoke high-entropy links. All instances must stop/drain and switch together as documented in `AUTH_MAIL_ROTATION.md`; mixed old/new instances do not provide global revocation. No live rotation occurred.
4. **Independent queue review corrections.** Optional registration profile fields set to undefined were initially rejected, and dedupe originally omitted the epoch. Both were corrected with regression tests. Core also bounds pre-send retries, fences leases before dispatch, skips stale/expired/revoked work, and treats ambiguous delivery as UNKNOWN without automatic resend. See the final verification report for independent final review status.

## Reviewed invariants and limitations

- Wrong-code path returns null so its guarded attempts increment commits; account mutation failures throw and roll back consumption/mutation/revocation together. Serializable conflicts retry whole transactions at most three times. User row lock serializes issue/consume/reset. Simulated transactions verify intended control flow only.
- Address quota uses database upsert with atomic increment and a bounded first-insert unique-collision retry. Keys include normalized principal, scope and window, shared across workers. Missing database fails closed. Fixed windows permit boundary bursts; expired rows need an approved retention job.
- Concurrent registration relies on database email uniqueness. Collision is caught without falling back to update/overwrite; nested organization/preference create is part of Prisma nested write. New mock tests exercise concurrent collision handling; actual PostgreSQL uniqueness behavior is not re-proven here.
- Session creation rechecks the password hash after user lock. Bridge issuance rechecks the originating live session under the same lock, and bridge consumption/session creation occur together. Reset and verification revoke sessions and bridges in their transaction.
- Links use configured origin, not request headers. Mail failures expose fixed codes; deadline covers response parsing; no automatic retry/fallback. Accepted is not delivered.
- Migration invalidates outstanding credentials and drops the plaintext code column. New code also requires the added request-limit table, outbox table and credential_version column. Old/new application versions cannot run safely against the same schema during arbitrary rolling deployment. No schema compatibility or migration execution has been accepted yet.

## Required environment variable names (values deliberately omitted)

- `DATABASE_URL`
- `DIRECT_URL`
- `AUTH_PUBLIC_ORIGIN`
- `AUTH_EMAIL_CODE_SECRET`
- `AUTH_EMAIL_CREDENTIAL_VERSION`
- `AUTH_MAIL_WORKER_SECRET`
- `MAIL_PROVIDER`
- `MAIL_FROM`
- `ZOHO_MAIL_ENDPOINT`
- `ZOHO_MAIL_TOKEN`
- `RESEND_API_KEY` (only for explicitly selected Resend)
- `NODE_ENV`

`CLIMATE_PASSPORT_DATABASE_URL` is an existing optional database alias, not a reason to discover or use an unknown connection. `NEXT_PUBLIC_SITE_URL` and `CHANNEL_BRIDGE_TARGET_PATH_PREFIXES` are existing site/channel configuration, not new secrets.

## Isolated integration plan — not executed

1. Obtain an approved ephemeral PostgreSQL instance bound to loopback in a fresh disposable test workspace, and official Prisma engine/client for the pinned lockfile. Latest bounded diagnosis found no postgres/psql executables or installed Prisma engine; local Docker daemon is now available but has no images. See AUTH_MAIL_TYPE_DIAGNOSTIC.md for the updated capability snapshot. Do not reuse an unknown remote URL or load the repository's real environment files. Explicit synthetic-only database configuration must be set before importing the application Prisma helper, which otherwise may read .env fallbacks.
2. Apply the existing migration chain to this empty test database, seed only synthetic ACTIVE/unverified, ACTIVE/verified, PENDING and suspended accounts plus tokens/sessions/bridges, then apply this migration. Assert old challenges consumed, plaintext code removed, code_hash/table/index mapping correct, and old application code excluded from cutover. Verify new Prisma client generation and full application typecheck/build.
3. Using at least two independent connections/workers, race duplicate correct tokens, wrong codes, correct-versus-fifth-wrong attempts, issue-versus-consume, reset-versus-login and reset-versus-bridge issue/exchange. Assert one consumption, attempt ceiling, transaction rollback on injected mutation failure, and no post-reset session from stale credentials.
4. Run a controlled worker against a mocked transport, race queue claims/lease expiry, verify UNKNOWN is never reclaimed, safe retries stop at three attempts, old-epoch and stale requests skip, optional profiles enqueue, and same-epoch dedupe works. Then race same normalized-email registrations and quota increments at limit/window boundaries across workers; verify no overwrite or orphan nested writes and shared quota enforcement. Re-run the preregistration attack through actual HTTP handlers: email holder's chosen password must replace attacker password and only that new password can log in. Verify public request acknowledgment is independent of eligible-account/provider latency, and confirm the scheduler is an explicit external deployment dependency.
5. Inject mail transport locally; deny external egress. Exercise accepted/rejected/timeout/ambiguous outcomes, secret rotation across worker restart, and old-link/code recovery. Assert no live provider requests, secrets or credential URLs in logs. Real provider/DNS/end-to-end delivery requires separate authorization and remains outside this plan.
6. Record SQL/transaction outcomes, typecheck/build results and sanitized test report before approving any production cutover. Remove the disposable database afterward. This document is a plan, not execution evidence.
