# CP auth/mail security implementation — local review only

Base: `913720bff568937f37744aa8124da75a37bc7917`. No commit, push, deployment, real database migration or live email was performed. Earlier five-site demos and proposed CP contract remain separate uncommitted deliverables. Zoho console delivery reported by the user is not an API integration test.

## Implemented behavior

- Explicit Zoho CPaaS/Resend transport selection, required sender/endpoint, validated acceptance response, bounded timeout and sanitized failure codes. No automatic retry or provider fallback; acceptance is not delivery.
- The controlled queue worker creates only new ACTIVE/unverified accounts with an unusable empty password placeholder; existing accounts, including PENDING partner records, are never overwritten. Email verification gates login. Partner claim/consent and independent partner passwords remain outside this flow; no partner password transfer was introduced.
- Registration, verification request and forgot-password persist the same account-independent outbox request and acknowledge only durable enqueue. They do not query users, hash passwords or contact providers. Storage failures return generic 503. Passwords/raw tokens/codes are not persisted in jobs. Worker outcomes are separate from request acknowledgment; there is no fire-and-forget send. Login performs one real-or-dummy bcrypt check before rejecting missing/ineligible credentials. Absolute network/database timing indistinguishability is not claimed.
- Trusted `AUTH_PUBLIC_ORIGIN` supplies links; request Host/Origin is not trusted. Link tokens remain hashed; six-digit codes use a per-challenge HMAC and an operator-managed secret. Five wrong attempts are persisted; reissue cannot refresh the remaining live budget.
- Token consumption, account mutation and password-reset revocation run in one Serializable transaction with account row lock and bounded conflict retries. Account email, ACTIVE state, purpose, expiry and verification state are rechecked. Reset revokes all sessions, bridge tokens and email credentials. Verification requires a new password chosen by the mailbox holder and atomically replaces the untrusted preregistration password, clears legacy reset fields and revokes all old sessions/bridges/tokens. It does not create a session or reactivate a suspended/pending account.
- Login session creation locks the account and checks the exact password hash previously verified. Bridge issuance rechecks the originating live session under the same lock; bridge exchange consumes and creates a session in one transaction. Legacy plaintext passwords are rejected; bcrypt inputs over 72 UTF-8 bytes are rejected.
- Database-backed fixed-window address quotas supplement process-local IP heuristics. Register/request/reset-request share one send quota. Storage failure is fail-closed. Request-limit rows need an operator-scheduled retention policy; none is executed here.

## Configuration and cutover gates

`.env.example` has blank secret placeholders only. Required: trusted `AUTH_PUBLIC_ORIGIN`, `AUTH_EMAIL_CODE_SECRET` of at least 32 characters, `AUTH_EMAIL_CREDENTIAL_VERSION`, dedicated `AUTH_MAIL_WORKER_SECRET`, `MAIL_PROVIDER`, `MAIL_FROM` and the selected provider credentials. No credential was generated or read. Temporary sender is configurable `no-reply@climatepassport.org`; intended future sender `no-reply@notice.climatepassport.org` remains conditional on provider/DNS readiness. Other site-domain references were not migrated.

Zoho endpoint must match the actual data center; currently only the officially verified `https://cpaas.zoho.com/v1.1/email` host/path is accepted, with no default. Other DCs need verified official documentation and reviewed allowlist additions. `climatepassport_mail_agent` remains an operator-side identity/configuration target; this code does not provision provider agents.

Migration `20261001000000_auth_email_security` invalidates outstanding email tokens, drops plaintext code, adds `code_hash` and `AuthRequestLimit`. Old and new code/schema are incompatible: coordinate maintenance and deploy together only after isolated database validation and operator authorization. Existing PENDING accounts require a separate approved claim flow; legacy plaintext accounts require verified recovery. Do not apply this migration to real data as part of this review.

## Verification scope

Run `npm test` for existing tests plus injected mail transport, mock transaction, route, quota and session regression tests. Mock concurrency and rollback tests exercise control flow; they do not prove PostgreSQL lock/isolation behavior. Tests never connect to a real database or provider.

Full typecheck/build remains blocked by the previously observed Prisma engine download HTTP403 and absent generated client. No network or permission bypass was attempted. Actual PostgreSQL concurrency, migration compatibility, API credentials, DNS and end-to-end delivery remain unverified. Check the accompanying verification report for exact counts and lint results. Independent review and the isolated integration plan are in `AUTH_MAIL_INDEPENDENT_REVIEW.md`. The reviewed synchronous account/provider timing branches have been removed from email request paths; no universal constant-time guarantee is claimed. Worker and rotation operations are documented in `AUTH_MAIL_OUTBOX.md` and `AUTH_MAIL_ROTATION.md`.

Protocol reference: https://www.zoho.com/cpaas/help/api/email-sending.html . `request_id` is a provider request identifier, not SMTP Message-ID.

Additional prepared migration `20261001010000_auth_mail_outbox` adds the durable queue and credential epoch. Both prepared migrations and matching application/worker versions require coordinated cutover. Neither migration was executed.
