# External learning evidence integration (v1, Phase 2A)

This is a provider-neutral receipt boundary, not an LMS integration. Providers are **DRAFT** by default and webhook delivery is unavailable until an administrator activates a provider with a production secret-manager resolver.

## Generic delivery envelope

`POST /api/integrations/learning/{webhookPathKey}/webhooks` uses a provider-configured HMAC-SHA256 signature, timestamp, delivery ID and event-type header names. The signature is calculated over the exact raw body bytes. A timestamp must be within five minutes; delivery IDs are idempotent per provider. Requests are rate limited, bodies are capped at 64 KiB, and rejected/disabled providers return 404 before their body is read.

The server persists a receipt only after verification, returns `202`, and performs **no normalization, reconciliation, completion, certificate, achievement, points, badge, or outbound writeback action** in the request.

## Storage and states

Inbox records contain delivery ID, event type, verified signature state, processing state, payload SHA-256, and an allowlisted/redacted header subset. Raw bodies and authorization/signature headers are never stored. Evidence is append-only and uniquely identified by provider plus external event ID when a future worker normalizes it.

Inbox: `RECEIVED` / `PENDING_RECONCILIATION` / `REJECTED`; signature: `PENDING` / `VERIFIED` / `REJECTED`. Evidence: `RECEIVED` → `RECONCILIATION_PENDING` → `RECONCILED` or `REJECTED`; reconciliation is `NOT_STARTED`, `PENDING`, `MATCHED`, `UNMATCHED`, or `REJECTED`; writeback is intentionally `NOT_REQUESTED` or `BLOCKED`.

## Administration and prerequisites

Only `ADMIN` may manage providers, accounts, mappings, or inspect bounded inbox/evidence APIs. Accounts are created from a raw subject ID only in an ADMIN mutation; course mappings likewise accept raw course ID only in their ADMIN create mutation. Both values are immediately SHA-256 referenced, never returned as plaintext, and lists are cursor-paginated (maximum 100). Account transitions are `VERIFY` and `DISABLE`; mapping transitions are `ACTIVATE` and `DISABLE`. Mapping creation/activation requires an ACTIVE provider, exactly one existing target (Learning Experience program XOR Activity), and a provider-scoped course-reference uniqueness check. Creation and status transitions are safely audited without raw IDs. Provider secret references are opaque; values are never persisted. `local:EXTERNAL_LEARNING_WEBHOOK_SECRET` resolves only outside production. Production requires a secret-manager resolver and shared sensitive rate limiter before activation.

Phase 2B requires an approved worker, explicit provider selection, secret-manager integration, parsing contract, reconciliation policy, and operational runbook. Phase 2C requires separate approval for reviewed apply/writeback semantics; automatic completion or rewards remain prohibited.
