# Transactional mail transport — implementation, not live delivery acceptance

Current implementation: `apps/passport-web/lib/server/mailer.ts`.

## Configuration

- `MAIL_PROVIDER`: `zoho` or `resend`; omission preserves the historical Resend selection. Set explicitly in deployment configuration.
- `MAIL_FROM`: required; accepts a single address or `Climate Passport <address>`. There is no hardcoded fallback sender.
- Zoho: `ZOHO_MAIL_TOKEN` and `ZOHO_MAIL_ENDPOINT` required. Endpoint must be the explicitly operator-confirmed HTTPS URL ending in `/v1.1/email` for the actual account's data center. Never infer region from a sender domain.
- Resend: `RESEND_API_KEY` required only when selected. Switching this setting is an operator-controlled provider change, not an automatic fallback.

The current verified hostname allowlist contains **only `cpaas.zoho.com`**, sourced from the official CPaaS Send Email reference. This is not a default endpoint. Other regions are intentionally blocked until the actual account endpoint is confirmed from official documentation and added through code review. URL credentials, queries, fragments, custom ports and redirects are rejected. A Zoho Mail mailbox/SMTP credential is not interchangeable with the CPaaS send-mail token.

The configured sender target is `no-reply@notice.climatepassport.org`. As checked on 2026-10-02, the parent `climatepassport.org` publishes Zoho MX and SPF records, but `notice.climatepassport.org` has no visible A/CNAME/TXT response. This does not establish sender-domain verification, DKIM/SPF alignment or deliverability; confirm the exact records in the selected provider before sending. Set `MAIL_PROVIDER` explicitly in each deployment because local environment files may select different providers.

The authentication mail outbox requires an external approved scheduler to call the controlled worker endpoint. No scheduler is configured in this repository, so provider credentials alone do not complete the delivery chain. See [AUTH_MAIL_OUTBOX.md](AUTH_MAIL_OUTBOX.md).

Never commit credentials. No secrets or production configuration were read or written for implementation/testing.

## API and semantics

Existing `sendTransactionalMail({to, subject, html, text})` callers remain compatible. Optional second argument `{env, fetch, timeoutMs}` injects offline test dependencies. Default deadline is 10 seconds and covers request plus JSON parsing. Deadline aborts the request and is enforced even if a mocked transport ignores AbortSignal.

A successful result is `{provider, status:'accepted', providerRequestId? , providerMessageId?}`. Zoho `request_id` becomes `providerRequestId`. Resend's returned `id` becomes `providerMessageId`. Neither is the SMTP Message-ID; neither proves delivery. Delivery/bounce events and provider log reconciliation are not implemented by this function.

One send attempt is made. HTTP rejection, application-level rejection inside HTTP200, missing/invalid IDs, malformed JSON, network failure and timeout throw fixed `MailTransportError.code` values without provider bodies, recipients, URLs, tokens or nested causes. No automatic retry, fallback, double send, console logging or template rewriting occurs. Timeout/network failure can have an unknown acceptance outcome; reconcile provider records before any manually authorized resend.

Zoho uses Authorization `Zoho-enczapikey` prefix; structured from/to; subject, HTML and text; tracking disabled. Its documented single-recipient success must have one `data` entry with code `EM_104`, message `OK`, a request ID and no application error. Resend uses the HTTP API directly to apply the same bounded fetch transport and response validation; the existing dependency is not removed in this scoped change.

## Verification

`node --test tests/mailer.test.mjs`: 12 offline tests, exclusively injected transports. Includes wire shape, provider selection, expiry/revocation HTTP401/403, HTTP429/500, HTTP200 errors, invalid JSON/IDs, missing configuration, secret-bearing errors, hung transport/body, abort and late acceptance. No live send or provider login.

Standalone strict typecheck:

```sh
./node_modules/.bin/tsc --noEmit --strict --target es2022 --module nodenext --moduleResolution nodenext --lib es2022,dom --skipLibCheck apps/passport-web/lib/server/mailer.ts
```

Full application build and live DNS/provider/delivery checks are separate acceptance gates. Auth-token generation, expiry, activation/reset authorization and their audit are handled outside this transport.

## Official protocol references (checked 2026-10-01)

- https://www.zoho.com/cpaas/help/api/email-sending.html — endpoint, Authorization token prefix, payload and EM_104/request_id response.
- https://resend.com/docs/api-reference/emails/send-email — POST endpoint, Bearer header, payload and returned provider ID.

## Controlled authentication outbox worker entry

`POST /api/internal/auth-mail-worker` invokes `processAuthMailBatch(limit)` from `auth-mail-outbox.ts`. It has no GET handler, startup task, built-in cron, automatic polling or arbitrary mail endpoint. Only persisted REGISTER/VERIFY/RESET jobs are processed by that core module.

Invocation requires `AUTH_MAIL_WORKER_SECRET` configured to a dedicated random secret of 32–512 non-whitespace characters. This is a separate server-side worker credential, not the provider token or an end-user session. Provide its value only in `X-Auth-Mail-Worker-Secret`; never URL/query/cookies, repository or client configuration. Any query string is rejected. Comparison hashes both values to fixed-size SHA256 buffers then uses `timingSafeEqual`.

A manually controlled server operator or approved external scheduler may call POST over HTTPS with `Content-Type: application/json` and body `{ "limit": 1 }` (default 1; max 10). No recipient, template, token, job identifier or provider override is accepted. The streamed body is limited to 256 bytes regardless of Content-Length. Secret absence/invalidity returns 401 and does not touch the outbox. There is no worker activation from merely starting the app. Server/platform request duration must cover the chosen batch and bounded 10-second provider attempts; start with a batch of one. Unauthorized invocations never start processing.

The response contains only generic batch acknowledgment and `Cache-Control: no-store`. It is not a per-message send/delivery result. Exceptions return generic 503 without job, account, provider details or automatic retry. Core claim/lease/dispatch/finalization remains in `auth-mail-outbox.ts` and requires separate database verification.

`MailTransportError.outcome` guides core handling:

- `not-attempted`: local configuration/payload validation failed before network I/O.
- `rejected`: authoritative HTTP4xx other than 408, or explicit application rejection without contradictory acceptance.
- `unknown`: timeout/network failure, HTTP408/5xx, malformed response or contradictory accepted/error fields. Never automatically replay these; provider acceptance may have happened.

No provider idempotency is invented. UNKNOWN jobs must not be automatically claimed or sent again. A generic exception defaults to unknown unless core can prove the failure happened before a send attempt.

Additional checks: `tests/mailer-worker-control.test.mjs` has 6 mocked tests for no-startup behavior, POST-only control, missing/wrong secret, query/cookie rejection, bounded payload/batch, no arbitrary mail and sanitized response/errors. Transport suite now has 13 tests including outcome classification; combined **19/19 pass**. Route tests stub core processing and do not touch a database or provider. Actual scheduler setup and real worker invocation were not performed.
