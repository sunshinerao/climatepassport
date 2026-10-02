# Channel Shell Integration Specification

Governing authority: [Climate Passport 最高开发指导纲领](CP_MASTER_DEVELOPMENT_DIRECTIVE.md). This specification provides subordinate integration detail; the master directive prevails in any conflict.

Last updated: 2026-10-02 (independent-partner scope incorporated)

## Multi-programme target boundary (2026-09-18)

The implemented contract below remains bounded and backward compatible. Target extensions follow [functional requirements V2](CLIMATE_PASSPORT_FUNCTIONAL_REQUIREMENTS_V2.md), CP-FR-050 through 073, based on [FS, SHCW 2027 and Convener requirements](PROGRAMME_REQUIREMENTS_SYNTHESIS_20260918.md). These are planned capabilities, not currently callable endpoints.

Core owns shared identity, consent and CP-managed participation/evidence/credential truth. Programme business systems are independently developed and maintained outside CP, including business workflows, data models and workspaces. CP does not implement or host FS learning/editorial modules, SHCW private annual operations, or Convener membership/Credit/support modules. CP supplies reusable scoped interfaces, not bespoke business development. Shared asset storage only holds authorized resources; it is not a second editable programme database.

Required new contract families: scope/representation and authorized master data; unique source activity mapping; generic participation; private records/assets/versions and external decision receipts; consent/controlled publication access/withdrawal; personal/institutional contribution; scoped statistics/export and reliable receipts/reconciliation. Do not add programme-specific ActivateSeat, ComputeCredit, ManageLab or SupportRequest endpoints. V2 section 6 defines logical operations, not assumed URLs.

Each client must be registered with explicit programme/edition/object scopes, user versus service credentials, allowed origins/callbacks and revocation. Existing `SHCW` literal support does not automatically enable FS/CV clients, arbitrary tenants or OIDC. Real authentication/cookie/CSRF/logout behavior requires a reviewed design and dual-origin integration tests.

Use source uniqueness, expected revisions, idempotency, signed outbox/inbox delivery, separate receipt/application/publication states and failure reconciliation. Source-owned content cannot overwrite Core attendance/credential state. Withdrawal blocks protected publication reads before async cache/index cleanup; inability to establish current permission must not expose youth work. Retain current Passport ID and opaque QR semantics regardless of differing examples in partner drafts.

Scope clarification: this document's full Core-owned workflows and optional embedded/redirect modes describe thin shells. Independent partner systems are not automatically shells; they keep their UI, passwords, business data, and approval workflows and send authorized confirmed outcomes to CP through APIs. They do not have to redirect business operations into CP. See [Partner Identity And Trust Requirements](PARTNER_IDENTITY_AND_TRUST_REQUIREMENTS.md) for the governing independent-partner requirements.

## V1 implemented contract

The following sections preserve the earlier SHCW thin-shell integration detail. Apply them to existing thin-shell mode only; independent partner systems follow the scope clarification above. The bounded V1 inventory and current implementation status later in this document control claims about what is implemented.

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

## Historical thin-shell design reference

The following lists preserve the earlier thin-shell design inventory. They are subordinate to the master directive and the bounded V1 implementation/status above; they do not imply every listed endpoint, mode, rate limit, or deployment is currently available.

- event registration
- check-in validation
- certificate verification
- learning experience application
- profile/passport data
- participation status

### SDK mode

The shell uses `packages/passport-sdk` helpers for API calls, session bridge, target path validation, and embedded flow setup.

Use for:

- SHCW front-end integration
- future partner channel websites
- reducing duplicated request signing and response handling

### Embedded flow mode

The shell embeds Core-owned flows with channel theming or redirects into Core-hosted flows.

Use for:

- login/register
- event registration
- learning experience application
- verifier scanner
- certificate verification
- dashboard/passport views when deep integration is not required

### Session bridge

The current implementation includes one-time channel session bridge tokens:

- Core issues a short-lived token for an authenticated Passport session.
- Token is stored hashed at rest in `ChannelSessionBridge`.
- Shell exchanges the token once.
- Core consumes the token and creates the target session.

Required next rules:

- Token TTL must remain short.
- Tokens must be consume-once.
- Tokens must be stored hashed.
- `targetPath` must be allowlisted.
- Replay attempts must be logged.
- Rate limiting must be added to issue/exchange endpoints.
- Shell must not persist bridge tokens as long-lived credentials.

### Channel API contract principles

- Core APIs return only data the channel is authorized to display.
- Channel shell must pass channel identity where relevant.
- Channel shell must not decode trusted QR payloads locally.
- Channel shell must not rely on client-side QR contents as source of truth.
- Channel shell must not decide verifier permissions locally.
- Channel shell must not issue Passport IDs.
- Channel shell must not issue certificates outside Core rules.
- Channel shell must not write points, achievements, milestones, or participation records directly.

### Verifier integration

Verifier is integrated into Climate Passport Core, but exposed as API capability.

SHCW or partner shells can provide a branded scanner UI, but must send the QR payload to Core for:

- decode
- permission check
- event rule check
- registration status check
- attendance confirmation
- verification logging

The shell receives a scoped result such as:

- valid
- invalid
- expired
- revoked
- wrong event
- not registered
- not approved
- already checked in
- permission denied

### Event and agenda integration

SHCW may present agenda, event pages, speaker pages, and branded event content.

For SHCW and other thin shells, registration, approval, attendance, check-in, participation records, points, and certificates must be Core-owned. Independent partners retain approval decisions and submit confirmed participation plus later corrections/cancellations; CP remains authoritative for its check-in service and CP-issued rewards.

Recommended pattern:

- SHCW renders event content.
- Register/apply buttons call or embed Core flows.
- User status widgets read from Core.
- Check-in and participation states read from Core.

### Learning Experience integration

SHCW may promote a learning experience or show a branded landing page.

For CP-native programs and thin shells, application, review, admission, participation, completion, certificate, points, milestones, and achievements are Core-owned. Independent learning providers retain their internal review/teaching workflows and submit relevant confirmed outcomes and evidence for CP assessment.

### Independent partner identity and trust

- An explicit, optional simultaneous-CP-registration choice may provision a private Passport without transferring the partner password or hash. It does not authenticate the person to CP.
- First CP password setup and existing-account linkage require CP-controlled ownership verification. Do not merge or expose records solely because an email matches.
- Partner API access does not grant password-reset, self-assigned trust, direct points-write, or unrestricted issuer authority.
- Institution trust, activity trust, evidence sufficiency, and versioned reward policies govern eligible certificates, badges, and points; a confirmed registration is not completion evidence.
- Blockchain anchoring is retained long-term but is not part of the current integration development plan.

### Certificate integration

SHCW may display certificate-related content and calls to action.

Certificate issue, revocation, verification, download authorization, and verification logs are Core-owned.

Public verification should resolve through `verify.climatepassport.org` or Core verification APIs.

The verification page follows minimum necessary disclosure and verifies the credential, not the person.

### Security requirements

- Use HTTPS only.
- Use short-lived bridge tokens.
- Hash bridge tokens at rest.
- Add rate limits to bridge and verifier APIs.
- Use target path allowlists.
- Use signed requests or channel credentials for server-to-server calls where needed.
- Never expose Core signing/encryption keys to shell code.
- Never place personal data in QR cleartext.

### Historical open questions

1. Final SDK package API shape.
2. Whether SHCW first integrates through redirects, embedded flows, or direct API forms.
3. Channel credential model for server-to-server operations.
4. Target path allowlist ownership and deployment config format.
