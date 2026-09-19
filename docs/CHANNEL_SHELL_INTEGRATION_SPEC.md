# Channel Shell Integration Specification

## Multi-programme target boundary (2026-09-18)

The implemented contract below remains bounded and backward compatible. Target extensions follow [functional requirements V2](CLIMATE_PASSPORT_FUNCTIONAL_REQUIREMENTS_V2.md), CP-FR-050 through 073, based on [FS, SHCW 2027 and Convener requirements](PROGRAMME_REQUIREMENTS_SYNTHESIS_20260918.md). These are planned capabilities, not currently callable endpoints.

Core owns shared identity, consent and CP-managed participation/evidence/credential truth. Programme business systems are independently developed and maintained outside CP, including business workflows, data models and workspaces. CP does not implement or host FS learning/editorial modules, SHCW private annual operations, or Convener membership/Credit/support modules. CP supplies reusable scoped interfaces, not bespoke business development. Shared asset storage only holds authorized resources; it is not a second editable programme database.

Required new contract families: scope/representation and authorized master data; unique source activity mapping; generic participation; private records/assets/versions and external decision receipts; consent/controlled publication access/withdrawal; personal/institutional contribution; scoped statistics/export and reliable receipts/reconciliation. Do not add programme-specific ActivateSeat, ComputeCredit, ManageLab or SupportRequest endpoints. V2 section 6 defines logical operations, not assumed URLs.

Each client must be registered with explicit programme/edition/object scopes, user versus service credentials, allowed origins/callbacks and revocation. Existing `SHCW` literal support does not automatically enable FS/CV clients, arbitrary tenants or OIDC. Real authentication/cookie/CSRF/logout behavior requires a reviewed design and dual-origin integration tests.

Use source uniqueness, expected revisions, idempotency, signed outbox/inbox delivery, separate receipt/application/publication states and failure reconciliation. Source-owned content cannot overwrite Core attendance/credential state. Withdrawal blocks protected publication reads before async cache/index cleanup; inability to establish current permission must not expose youth work. Retain current Passport ID and opaque QR semantics regardless of differing examples in partner drafts.

## V1 bounded SHCW journey

Climate Passport remains the system of record for Core-owned facts. The currently implemented versioned SHCW contract exposes only the endpoints below; it must not persist bridge tokens or duplicate Core identity or certificate state. This implementation inventory does not restrict the separately planned scoped contract extensions above.

* `POST /api/v1/channel/session/bridge` issues a short-lived, single-use token for an authenticated Core browser session.
* `POST /api/v1/channel/session/exchange` consumes it atomically and establishes the Core session.
* `GET /api/v1/channel/certificates/verify/{code}` is always public/minimum-disclosure.

Requests use JSON and `channel: "SHCW"`. Stable errors are `{ "error": { "code": "..." } }`. The SDK wrappers are `issueV1ChannelBridge`, `exchangeV1ChannelBridge`, and `verifyV1ChannelCertificate`. Bridge calls include credentials; verification omits credentials.

## Enablement and safety

The v1 endpoints are disabled by default. Set `CHANNEL_SHCW_ENABLED="true"` and only locale-root values in `CHANNEL_SHCW_TARGET_PATH_PREFIXES` (for example `/en,/zh`). Missing, malformed, or unsupported configuration fails closed. This is separate from legacy `CHANNEL_BRIDGE_TARGET_PATH_PREFIXES`; legacy unversioned endpoints retain their existing behavior.

Public verification returns only status, validity, verification code, optional message, and minimum certificate facts (title, holder name, masked Passport ID, issuer, dates, credential type, certificate number, and verification timestamp). It never exposes email, phone, internal IDs, extended fields, or audit/query counts.

## Current status and deferrals

This is a code-level Phase 1 contract and bridge foundation, not a production claim. No SHCW UI, external partner credentials, CORS/domain configuration, deployment, migration, or external end-to-end partner validation is included. Future channels require a new versioned contract/configuration review; `SHCW` is the only current key.

## Takeover baseline

The pre-existing atomic token service remains in `apps/passport-web/lib/server/auth.ts`; legacy routes remain under `/api/channel/...`. Contracts are in `packages/passport-contracts/src/index.ts`; the pure v1 resolver is `packages/passport-core/src/channel-config.ts`; v1 routes are under `apps/passport-web/app/api/v1/channel/`; and SDK v1 wrappers are in `packages/passport-sdk/src/index.ts`. The v1 verification adapter calls the existing public resolver with `SHCW_PUBLIC_API` and strips all non-minimum fields before response validation.
