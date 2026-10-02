# Current Implementation Status

Product baseline: [Climate Passport 最高开发指导纲领](CP_MASTER_DEVELOPMENT_DIRECTIVE.md). This file records implementation evidence and gaps; it does not override the master directive or establish completion by restating requirements.

Last updated: 2026-10-02 (Activity A/P role-boundary slice verified locally; earlier evidence remains dated per section)

### 2026-10-02 FigJam Activity A/P role boundaries (local)

EVENT_MANAGER Activity lists now combine organizer ownership with active Programme-scope read authorization; unmapped legacy activities retain their prior ownership behavior. Creation, lifecycle transitions, and verifier assignment are ADMIN-only, with matching detail-page controls and verifier management page restrictions. ADMIN global verifier management remains available. Evidence: `tests/activity-security-boundaries.test.mjs` (10), `tests/figma-cp-activity-role-boundaries.test.mjs` (4), `tests/activity-verifier-authorization.test.mjs` (3), full Node suite (852/852), and TypeScript check. This is source/type evidence only: isolated API database and browser E2E acceptance were not run. P certificate approval/automatic issuance and S scan acceptance remain open. Changes are uncommitted, unpushed, and undeployed.

## Current Review Snapshot (2026-09-18)

### Multi-programme requirements intake

Three programme inputs and the user's stricter separation decision are reconciled in [V2/V2.1](CLIMATE_PASSPORT_FUNCTIONAL_REQUIREMENTS_V2.md) and the [source comparison](PROGRAMME_REQUIREMENTS_SYNTHESIS_20260918.md). This is documentation only, with no new implementation/migration. CP gaps concern reusable scopes/delegation, generic controlled records/versions/consent, external decision validation, withdrawal and source mappings. FS Inquiry/editorial workspaces and Convener annual/support/assessment systems are external business ownership, not missing CP deliverables. Existing task/submission APIs and global ADMIN access are not automatically safe cross-programme interfaces.

CP-TODO-240 through 259 retain traceability, but 254/255/256 are now `external`, excluded from CP development and completion counts. The other 17 are narrowed to shared services/CP-side integration. Known P0 gaps remain open. Each programme independently develops its business code and UI; joint tests do not mean CP builds those systems. Source documents and historical mock test counts are not implementation evidence.

### 2026-09-19 audit P0 remediation (CP-AUD-001/002)

The two P0 release blockers from the [2026-09-19 requirements/implementation audit](REQUIREMENTS_IMPLEMENTATION_AUDIT_20260919.md) are fixed locally and covered by real-DB negative-matrix tests:

- Public certificate verification is now resource-authorized: only the holder and an EVENT_MANAGER who manages the certificate's source activity receive extended fields. ADMIN (no routine body browsing per CP-FR-051), VERIFIER (assigned or not), STAFF and SPECIAL_PASS_MANAGER receive public whitelist fields only; role names alone never grant extended access. Source activity resolution supports Activity check-in issuance and certificate batches; client-supplied application sources are not trusted for authorization.
- Verification audit logs no longer persist raw verification codes: found-certificate logs key on `CertificateIssue.id` only, and preview/not-found logs store a truncated `fp:<sha256-16>` fingerprint. Migration `20260919010000_scrub_certificate_verification_audit_codes` scrubs historical raw codes from metadata and subject ids.
- Evidence: `tests/api/certificate-verification-authorization.test.ts` (six-role real-DB matrix plus audit payload assertions), `tests/certificate-verification-service.test.mjs`, updated `tests/phase0-core-api-runtime-regression.test.mjs`. Applied to local dev and isolated test databases only; not deployed to production.

The same pass also closed the two P1 audit findings:

- CP-AUD-006 (application review race): `REQUEST_INFORMATION`/`REJECT` now use an in-transaction compare-and-set (`updateMany` conditioned on `status = SUBMITTED`); the loser gets 409 and exactly one final event, one notification, and one audit are written. `APPROVE_AND_ISSUE` kept its existing serializable transaction.
- CP-AUD-005 (best-effort audits): issuance (single/batch), revoke, restore, regenerate, and application review decisions now write their audit records in the same transaction as the state change; an audit persistence failure rolls the whole transition back and returns an explicit 500 instead of a silent "success without audit". Regeneration additionally moved from a plain update to a conditional update so it cannot clobber a concurrent revoke/restore. Visibility toggles and template copies remain best-effort (non-critical) and are listed as such in the audit record.
- Evidence: `tests/api/certificate-application-review-api.test.ts` (real-DB concurrent review: one 200 / one 409, single event/notification/audit), `tests/phase0-core-api-runtime-regression.test.mjs` (13 new review/audit-failure scenarios), `tests/certificate-records.test.mjs`.

### 2026-09-19 Person/institution governance (CP-TODO-242)

Closed locally. Migration `20260919070000_person_institution_governance` adds merge chains (`mergedIntoId`) for Person/Institution so original references stay resolvable. `lib/server/person-institution-governance.ts` implements claim (only VERIFIED, unclaimed records; no auto account creation or invitations), representation grant/revoke (compare-and-set, validity windows, MANAGE delegation), record merges (all relations migrated in-transaction, source rows preserved as aliases), and purpose-limited projections (`institution_context`/`person_identity` whitelists; internal fields such as legal contact data, ORCID and bios never leak). `GET /api/institutions/[id]` is the first representation-guarded consumer read; admin governance routes manage grants/revocations/merges; admin detail reads resolve merge chains. Affiliation is never read as authority. Evidence: `tests/person-institution-governance.test.mjs` (9 source-level assertions) and `tests/api/person-institution-governance-api.test.ts` (real-DB matrix: affiliation-only 403, READ cannot delegate while MANAGE can, revocation/expiry immediate, merged ids resolve on consumer and admin reads, in-transaction governance audits). CP-TODO-243 (channel user/machine authentication) is now closed locally except real-environment acceptance: a scope catalog lives in contracts, `channel_clients.machineKeyHash` verifies machine keys without ever persisting plaintext, `lib/server/channel-client-auth.ts` fails closed across the negative matrix, the v1 certificate verification route accepts registered machine clients while leaving the legacy SHCW path byte-identical, admin registry routes manage clients without leaking secret material, and the SDK exposes server-side machine credentials helpers. Evidence: `tests/channel-client-auth.test.mjs` and `tests/api/channel-client-auth-api.test.ts`. Real dual-origin/domain/cookie/CSRF acceptance stays with the CP-TODO-235 acceptance gate.

CP-TODO-244 (reliable outbox) is closed locally: `OutboundDispatch` commits in the same transaction as certificate revoke/restore (withdrawal/cancellation first, no fake success), claims with compare-and-set leases, retries with backoff, dead-letters exhausted or non-retryable rows, posts to registered callback URLs with idempotency/revision headers, records idempotent receipts that reject stale revisions, and exposes admin process/requeue/reconcile routes. Evidence: `tests/reliable-dispatch.test.mjs` and the end-to-end `tests/api/reliable-dispatch-api.test.ts` with an in-process HTTP receiver.

Remaining V2.1: 245 (source-mapping execution layer), 246/253/257 (Wave 2 migrations drafted, services pending), 252, 258, 259, plus the 235 real-environment acceptance. Inbox-side validation (signature, time window, dedup at receiving endpoints) is the receiving programme's contract duty per the field-ownership ADR.

### 2026-09-19 Wave 1: private records / assets / consents / receipts / publication gateway (CP-TODO-247~251)

Closed locally on top of the drafted Wave 1 migration `20260919100000_private_records_consents_publications` plus `20260919120000_object_authorization_personal_scope` (ObjectAuthorization.programmeId nullable = personal-object grants) and `20260919130000_external_receipt_content_hash` (receipt content hash + validity window). Not deployed to production.

- **CP-TODO-247 private records**: `lib/server/private-records.ts` — default-private scoped records with immutable revisions (compare-and-set update, 409 on revision conflict, no overwrite), owner > ObjectAuthorization grant (purpose + validity window) > programme membership; withdrawal hides the record from non-owners (404) and blocks updates. Routes `/api/records` (+ `[id]`/grants/revisions/evidence).
- **CP-TODO-248 controlled assets**: `lib/server/controlled-asset-storage.ts` + `controlled-assets.ts` — magic-bytes type detection (wrong/malicious MIME rejected), size+sha256 integrity, JPEG EXIF / PNG eXIf location-metadata stripping, scan gate (pending unusable, infected quarantined, admin quarantine route), immutable evidence versions, derivative access inherits the original asset's restrictions (never the reverse). Routes `/api/assets` (+ content/finalize) and `/api/admin/assets/[id]/quarantine`.
- **CP-TODO-249 consents**: `lib/server/consents.ts` — independent purposes (`account_terms`/`programme_operation`/`image_use`/`attribution`/`contact`/`endorsement`), guardian grants require guardian identity + evidence reference (contact email never suffices), versioned re-grants with supersede, immediate withdrawal that blocks dependent publishing. Routes `/api/consents` (+ withdraw). Real-youth enablement still requires approved policy.
- **CP-TODO-250 decision receipts**: `lib/server/external-decision-receipts.ts` — machine-authenticated minimal receipts (issuer = registered ChannelClient key), canonical content hash over 7 content fields (idempotency key excluded) so same-key/same-content dedups and same-revision duplicates resolve, 409 on key conflict and stale revisions, latest-decision-wins with expiry. Routes `/api/external/decision-receipts` and admin list.
- **CP-TODO-251 publication gateway**: `lib/server/publication-gateway.ts` — immutable per-version projections (idempotent republish, conflict 409), withdrawn versions can never be republished (new version required), new versions never unpublish valid old ones, fail-closed public read gate (`Cache-Control: no-store`), consent gate (missing vs withdrawn distinct codes) and optional approval-receipt gate, publish/withdraw fan out to `dispatch:publications` subscribers in the same transaction with locator-only payloads. Routes `/api/publications` (+ withdraw) and admin list.
- Evidence: source-level suites `tests/private-records.test.mjs` (8), `tests/controlled-assets.test.mjs` (19), `tests/consents.test.mjs` (12), `tests/external-decision-receipts.test.mjs` (11), `tests/publication-gateway.test.mjs` (14); real-DB API matrices `tests/api/private-records-api.test.ts`, `tests/api/controlled-assets-api.test.ts`, `tests/api/consents-api.test.ts`, `tests/api/external-decision-receipts-api.test.ts`, `tests/api/publication-gateway-api.test.ts`. Boundary kept: no Inquiry/ActionPlan/mentor business models or pages in CP.

### 2026-09-19 V2.1 multi-programme scope foundation (CP-TODO-240/241, CP-AUD-003 first batch)

The V2.1 shared-scope base is started; the audit finding stays open until CP-TODO-242~245 land:

- Field ownership, scoped contracts and reuse boundaries are frozen in [FIELD_OWNERSHIP_AND_SCOPE_ADR_V21_20260919](FIELD_OWNERSHIP_AND_SCOPE_ADR_V21_20260919.md): CP-authoritative fields vs programme-authoritative fields, no business rule packages, and no routine body browsing for CP technical operations (CP-FR-051).
- Additive migration `20260919060000_multi_programme_scope_foundation` (applied to local dev and isolated test databases only, not production) adds `Tenant`, `Programme`, `Edition` (1..n per programme), `AccessMembership` (user × programme × edition × scoped role), `ObjectAuthorization` (object-level grants with purpose/validity/revocation), `InstitutionRepresentation` (explicit representation; employment/affiliation never grants it), `ChannelClient` (machine identity + scoped contract + dual origins; secrets referenced, never stored) and `SourceObjectMapping` (unique sourceSystem+sourceEditionRef+sourceObjectId, source version, authoritative-field allowlist). All changes are additive; existing rows and summer-school behavior are untouched.
- New authorization service `apps/passport-web/lib/server/programme-scope.ts`: `resolveScopedAccess(actor, scope, action, object)` fails closed — unknown/inactive/conflicting or archived scopes denied, cross-programme and cross-edition denied, validity windows enforced, revoked grants die immediately, and global `UserRole` (including ADMIN) never auto-crosses into a programme. Wired into a minimal but real enforcement point: `/api/activities/[id]/institutions` GET (read) and POST (write, after `canManageActivity`); activities without a scope mapping keep legacy behavior as the frozen-summer-school control.
- `packages/passport-contracts` `ChannelKeySchema` widens from the fixed `"SHCW"` literal to a registrable key pattern (SHCW stays valid); the v1 bridge/exchange routes fail closed (`CHANNEL_DISABLED`) for any other key until CP-TODO-243 registers new clients.
- Evidence: `tests/programme-scope-service.test.mjs` (14 source-level assertions) and `tests/api/programme-scope-authorization.test.ts` (15 real-DB matrix cases across three fictional programmes and two editions: same-scope read/write positives incl. object-level grants, cross-programme/cross-edition/unknown-scope/anonymous/global-ADMIN negatives, VIEWER write denial, revocation immediacy, unmapped legacy objects unchanged). Full gates green: 398/398 Node, API 46 pass + 6 explicit skips, lint, build, `db:validate`.
- Remaining in CP-AUD-003: CP-TODO-242 (Person claim + representation service), 243 (channel user/machine auth + environments), 244 (outbox/inbox), 245 (source mapping execution layer); the rest of the activity/admin/certificate surface is not yet scope-asserted.

### 2026-09-19 Wave 2 first delivery: occurrences, multi-role, taxonomy, attendance correction (CP-TODO-246)

Closed locally. Migration `20260919150000_activity_occurrence_execution` (applied to local dev + isolated test DBs only, not production) links `activity_applications.occurrenceId`, adds `activity_person_roles` (unique activity+person+role), `activity_external_classifications` (unique activity+taxonomySystem+taxonomyRef, idempotency-key unique, versioned status) and checkin-correction columns (`isCorrection`, `noteJson`).

- **Occurrences with atomic admission (CP-FR-054/055)**: `lib/server/activity-occurrences.ts` — per-occurrence capacity mutated only via read-then-CAS on `admittedCount` (null capacity = unlimited), so concurrent admissions never exceed capacity; `admitApplicationToOccurrence` claims the seat and CAS-marks the application `APPROVED` with `occurrenceId` in one transaction (status race returns the seat); `releaseSeatAndPromoteWaitlist` frees a seat and promotes the earliest `WAITLISTED` application in the same transaction. The review route accepts an opt-in `occurrenceId` — the legacy path without it is byte-identical (summer-school frozen control); leaving `APPROVED` releases the seat and auto-promotes with notification and approval-consistent rewards. PROJECT applications reject `occurrenceId`; batch review stays occurrence-free by design. Occurrence CRUD is manager-only with in-transaction audits; public lists hide `CANCELLED` occurrences; cancellation is single-use and refuses occupied occurrences.
- **Multi-role assignments (CP-FR-054)**: `lib/server/activity-person-roles.ts` — idempotent assignment per (activity, person, roleType) with P2002 loser-reread; affiliation never grants a role; `listActivityPeople` reports `distinctPersonCount` so one person holding multiple roles is never double-counted.
- **External taxonomy references (CP-FR-054)**: `lib/server/activity-taxonomy.ts` — CP stores only lawful version projections of programme-owned classifications: idempotency key + content hash (same key/different content → 409 `TAXONOMY_CONFLICT`), monotonic `sourceVersion` (older → 409 `TAXONOMY_STALE`), idempotent withdraw that a newer version can re-activate, in-transaction audits. Machine facade `/api/external/activity-taxonomy` set/withdraw reuses the registered `channel:activities:source` scope; public read at `/api/activities/[id]/classifications`.
- **Attendance correction (CP-FR-056)**: `recordAttendanceCorrection` in `lib/server/activity-participation.ts` — reason mandatory, evidence asset references stored on the checkin record, `CHECKED_IN` → 409 `ATTENDANCE_ALREADY_RECORDED` (no duplicate record), state machine enforced, `rewardsTriggered: false` (corrections never mint rewards). Route `POST /api/activity-participations/[id]/attendance-correction` is manager-only with in-transaction `ACTIVITY_ATTENDANCE_CORRECTED` audit.
- Contracts add `OCCURRENCE_*`, `TAXONOMY_*`, `ATTENDANCE_*`, `PARTICIPATION_NOT_FOUND` error codes plus occurrence/person-role/taxonomy/correction zod schemas.
- Evidence: `tests/activity-occurrences.test.mjs` (14 source-level assertions) and `tests/api/activity-occurrences-api.test.ts` (real-DB matrix: full→waitlist→release→promotion cycle with notification/audit, concurrent admissions landing exactly at capacity, role statistics dedup, taxonomy auth/idempotency/version/withdraw-restore, correction no-duplicate with evidence + audit).

Remaining V2.1 after this batch: 253/257 (Wave 2 tables exist, services pending), 252, 258, 259, plus the 235 real-environment acceptance.

### 2026-09-19 Wave 2 second delivery: contribution facts with verification levels (CP-TODO-253)

Closed locally. Migration `20260919160000_contribution_fact_execution` (applied to local dev + isolated test DBs only, not production) enforces one `ACTIVE` fact per natural key (person × contributionType × source) via partial unique index, adds `occurredAt` and scoped indexes.

- **Recording**: `lib/server/contribution-facts.ts` — self-reported facts always start at `SELF_REPORTED` regardless of recorder (including ADMIN); a second ACTIVE fact on the same natural key → 409 `CONTRIBUTION_CONFLICT` (index + explicit null-source check + P2002 race mapping); programme-scoped facts require an active `AccessMembership`; recording institution-subject facts on behalf requires `InstitutionRepresentation` MANAGE. Key writes and audits in one transaction.
- **Evaluation (CP-FR-062)**: verification levels are monotonic — same level idempotent, regression → 409 `CONTRIBUTION_VERIFICATION_INVALID`; the recorded person can never evaluate their own fact even with representation (self-report never upgrades third-party verification); evaluators are ADMIN, MANAGE representatives or programme admin/operators; CAS + in-transaction audit.
- **Corrections**: the original row CAS-moves to `CORRECTED` and a successor takes the same natural key with a `correctionOfId` chain; owner corrections reset to `SELF_REPORTED`, authorized corrections preserve the level; corrected rows are immutable. **Withdrawal** is idempotent and removes the fact from derived statistics immediately (撤销可复算).
- **Statistics**: `contributionStats` aggregates ACTIVE rows only — fact counts, distinct persons (never double-counted), per-person quantity sums (activity totals are never copied to each person), level breakdown; aggregates only, no individual rows. The list endpoint is the record/portfolio adapter read surface (ACTIVE by default, `includeHistory` opt-in). No reward triggers are wired in, so adapters cannot double-count or mint rewards.
- Contracts add `CONTRIBUTION_*` error codes, the verification-level enum and record/evaluate/correct/withdraw zod schemas.
- Evidence: `tests/contribution-facts.test.mjs` (8 source-level assertions) and `tests/api/contribution-facts-api.test.ts` (real-DB matrix: owner/record authorization, duplicate conflict, monotonic evaluation with self-eval ban, correction chain with statistics recompute, idempotent withdrawal, institution representation matrix, aggregates-only stats).

Remaining V2.1 after this batch: 257 (Wave 2 notification tables exist; retry/preferences/reports/retention services pending), 252, 258, 259, plus the 235 real-environment acceptance.

### 2026-09-20 Wave 2 third delivery: notification delivery, privacy reports, export/deletion, marker replay (CP-TODO-257)

Closed locally. Migration `20260919170000_notification_delivery_privacy_lifecycle` (applied to local dev + isolated test DBs only, not production) adds notification retry columns (`nextRetryAt`, `deadLetteredAt`), the append-only `privacy_markers` table and user anonymization columns. Notification preferences reuse the pre-existing per-user `notification_preferences` table (no duplicate table created).

- **Notification delivery with retry evidence (CP-FR-066)**: `lib/server/notification-delivery.ts` — every delivery writes a `NotificationAttempt` (SUCCESS/FAILED/SKIPPED); EMAIL/SMS carry title + locator link only (private body never leaves the platform); failures retry with exponential backoff and dead-letter after max attempts; channel opted-out (existing preference flags, incl. marketing gate) → SKIPPED + dead-lettered without infinite retries. Admin routes: `POST /api/admin/notifications/process`, `GET /api/admin/notifications/[id]/attempts`.
- **Privacy-safe reports (CP-FR-067)**: `lib/server/privacy-reports.ts` — aggregates only (applications/participations by status, checkin count, distinctPersons = application∪participation dedup); small-sample suppression (`0 < n < threshold → null` + `suppressedCells`; threshold via `CP_PRIVACY_REPORT_MIN_CELL`, default 5, approval-gated). Route `GET /api/reports/activity-privacy` (manager/ADMIN).
- **Export / deletion / backup replay (CP-FR-068)**: `lib/server/privacy-lifecycle.ts` — three separate actions: export (`GET /api/account/export`: owned records with payloads, grants held as index-only entries, asset metadata index, explicit `otherAuthorsContentIncluded: false`); deletion (`POST /api/account/delete`, requires `confirm: true` → else 400 `PRIVACY_DELETE_CONFIRMATION_REQUIRED`: anonymizes User/Person, revokes sessions, withdraws owned ACTIVE records, writes an append-only privacy marker per withdrawal/deletion, in-transaction audit, returns a restricted-retention notice); restore replay (`POST /api/admin/privacy/replay-markers`: re-anonymizes DELETED users incl. session revocation, re-applies WITHDRAWN records, idempotent skip — replay markers before opening reads).
- Contracts add `NOTIFICATION_NOT_FOUND`, `PRIVACY_DELETE_CONFIRMATION_REQUIRED`, `PRIVACY_MARKER_REPLAY_INCOMPLETE` and process/report/delete schemas.
- Evidence: `tests/notification-privacy.test.mjs` (11 source-level assertions incl. backoff schedule, suppression cells, export index-only grants, replay idempotency) and `tests/api/notification-privacy-api.test.ts` (real-DB matrix with real mail outbox asserting no private body in mail, opt-out → SKIPPED dead letter, report 401/403 + suppression, export ownership matrix, delete confirmation gate + anonymization + revoked sessions + withdrawn records + markers + relogin denial, replay idempotency + audit).
- Test infra: the two documented concurrency-fragile reliable-dispatch loops now process with limit 50 (their own comments already describe pool sharing; limit 10 could be crowded out by other due rows under 15-file concurrency). Verified via isolation experiments that the service logic itself is correct (dead-letter at exactly 5 attempts; pair runs 12/12).

Remaining V2.1 after this batch: 252 (generic sourceRef/schema contract + CP-side FS integration example), 258 (CP-owned generic pages/SDK components/E2E), 259 (joint acceptance, migration dry-runs, ops handover), plus the 235 real-environment acceptance. Wave 2 (246/253/257) is now fully delivered.

### 2026-09-20 V2.1 shared-layer wrap-up: sourceRef contracts + FS integration example (CP-TODO-252)

Closed locally. Contracts gain `SourceRefSchema` / `SourceRefResolveResponseSchema`, the `channel:source:resolve` machine scope and `SOURCE_REF_NOT_FOUND` / `SOURCE_SCHEMA_UNKNOWN` codes.

- **Generic source references (CP-FR-071)**: `lib/server/source-ref-contracts.ts` — `resolveSourceRef` fails closed unless `system` is a registered active MACHINE ChannelClient key; person/institution references resolve `mergedIntoId` merge chains to the final target; four object types expose versioned whitelist projections only (`cp.person_identity/v1`, `cp.institution_context/v1`, `cp.activity_brief/v1`, `cp.record_summary/v1`) — bio/ORCID/legal names/contact emails/organizer accounts/record bodies never leak; responses carry a locator plus a sha256 content hash for source-side version snapshots and reconciliation; in-transaction `source_ref.resolve` audits. `validateAgainstSourceSchema` enforces CP whitelist schemas only and never understands programme-proprietary schemas.
- **Machine facade + SDK**: `POST /api/external/source-refs` (machine auth, scope-gated); `ClimatePassportClient.resolveSourceRef` server-side helper validates the contracts response schema.
- **FS integration example**: the batch's API test simulates the Future Stewards flow — FS registers its system (client key = `sourceRef.system`), stores plain sourceRef triples on its own artifacts, resolves them through the facade and validates projections against `schemaRef`. No programme business models or relationship graphs enter CP; FS builds its own Lab/learning/editorial systems.
- Evidence: `tests/source-ref-contracts.test.mjs` (5 source-level assertions) and `tests/api/source-ref-contracts-api.test.ts` (real-DB FS-simulation matrix: machine auth 401/403, all four object types through the contracts response schema, whitelist negatives, unknown system 404, deactivated system 401 at the auth layer, hash reconciliation, audits).

Remaining V2.1: 258 (CP-owned generic pages, SDK components, CP-side E2E), 259 (joint acceptance, migration dry-runs, operations handover, per-programme release recommendation), plus the 235 real-environment acceptance. All shared-layer service batches (240–245, 246–253, 257) are now delivered.

### 2026-09-20 CP-owned pages, reusable UI flows and browser acceptance (CP-TODO-258)

Closed locally. New workspace package `@climate-passport/passport-ui-flows` (TS-source exports, same pattern as contracts/sdk) with three presentational components — `DataActionCard`, `ConfirmDangerAction` (type-to-confirm danger pattern with aria-disabled semantics and a retention-notice surface), `StatusPill` — no data fetching, no programme-specific flows, themeable via className + data-tone; Storybook stories included.

- **Three CP-owned pages** (thin server pages with `requireAuthenticatedUser` redirect-back, bilingual screens, hand-written CSS on `--cp-*` tokens with 480/760/1024 breakpoints plus the desktop default): `dashboard/account-data` (export download + delete gated on typing DELETE + restricted-retention notice — the FR-068 three-separate-actions frontend), `dashboard/consents` (FR-060 frontend), `dashboard/records` (FR-057 frontend). The account menu links all three bilingually.
- **CP-side end-to-end evidence**: `tests/e2e/cp-data-governance.spec.ts` (10 tests) — unauthenticated redirect-back to the original page after login, zh/en copy, no horizontal overflow at 360/768/1024/1440, keyboard Tab+Enter opening the mobile menu, export download event with filename, the delete confirmation gate (disabled → wrong value → DELETE → success + retention notice → session invalid), and consent/record create-list-withdraw flows.
- `tests/cp-ui-flows.test.mjs` (6 file-level assertions) covers component purity, auth-gated pages, bilingual menu links, CSS breakpoints and e2e coverage. FR-072/073 boundary kept: programme workspaces (Inquiry/mentor/editorial/seats/tickets) remain external; the 14 pre-existing explicit e2e skips stay closed.
- Gates: `npm test` 551/551; `npm run test:api` 143/143 (one rerun after the documented concurrency-sensitive publication fan-out assertion flaked once — unrelated to this frontend batch); `npm run test:e2e` 37 passed + 14 explicit skips, 0 failed; lint clean; `next build` succeeds. Not deployed to production.

Remaining V2.1: 259 (joint acceptance, migration dry-runs, operations/recovery handover, per-programme release recommendation) plus the 235 real-environment acceptance.

### 2026-09-20 V2.1 completion: joint acceptance, dry-runs, handover, release recommendation (CP-TODO-259)

Closed locally — the V2.1 shared layer (CP-TODO-240~259) is fully delivered.

- **Source-test traceable acceptance**: `docs/V21_CAPABILITY_TEST_TRACEABILITY.md` maps every delivered item to its three evidence layers (source assertions → real-DB API matrix → browser e2e) with per-batch gate counts, plus scope-negative / withdrawal-concurrency / failure-recovery sections per FR-073.
- **Operations/recovery handover**: `docs/OPERATIONS_RECOVERY_HANDOVER.md` — environment layers, a six-area responsibility matrix, the backup-restore runbook (replay privacy markers before opening reads, with verification and record-keeping), dead-letter runbooks, monitoring points, escalation boundaries, key handling and migration management.
- **Per-programme release recommendation**: `docs/PER_PROGRAMME_RELEASE_RECOMMENDATION.md` — a seven-item release gate checklist and per-programme positions (SHCW frozen compat-only; FS contract-ready behind the youth-policy gate; Convener external), rollout order, and an explicit no-deployment-authorization statement.
- **Migration dry-run**: `scripts/migration-dry-run.mjs` applies all 44 migrations from empty on a guarded scratch database, validates, and force-drops it — executed 2026-09-20 (118 public tables, OK). `tests/v21-acceptance-handover.test.mjs` (4 assertions) guards these documents and the script's safety properties.
- Remaining external items: CP-TODO-235 real-environment acceptance (separately authorized) and CP-AUD-008 staged commits of the working tree.

### 2026-09-21 Outward Open API (user rulings 1–7 of 2026-09-21)

Delivered locally against the isolated test database only. Nothing committed, no production deployment. The additive migration `20260921120000_channel_client_key_lifecycle` is **applied to `climatepassport_test` but deliberately not to the local dev database** (`prisma migrate status` shows 44/45 applied, this one pending) — applying it to dev needs explicit authorization. Design and evidence: [OPEN_API_V1_zh.md](OPEN_API_V1_zh.md), contract [openapi/v1.yaml](openapi/v1.yaml).

- **Ruling 1 — key lifecycle**: `ChannelClient` gains `machineKeyIssuedAt`/`machineKeyExpiresAt`/`machineKeyBcrypt`/`rotatedAt`/`revokedAt`/`revokeReason` plus registration and policy columns. Expired keys answer 403 `API_KEY_EXPIRED` while revoked/disabled rows answer 401, so "this credential once worked but ran out of time" stays distinguishable from "this credential is not valid". Rotation takes an optional `expiresInDays` (capped by `MACHINE_KEY_MAX_VALID_DAYS = 730`) and a `reason`; the old key dies in the same transaction and the legacy unsalted `machineKeyHash` column is cleared on rotation.
- **Ruling 2 — bcrypt**: machine secrets are stored as salted bcrypt (`machineKeyBcrypt`), so there is no digest lookup. The bearer credential is therefore self-locating: `<clientKey>.<machineKey>` (≤136 chars) finds the row by `clientKey`, then compares per-row. Secret length is constrained to 16–72 chars because bcrypt truncates at 72 bytes.
- **Ruling 3 — mandatory source constraint**: `evaluateSourceConstraint` treats any `Origin` header as a browser call, which must match that key's `allowedOrigins` — an empty allowlist no longer means "allow" (carrying an API key into a browser already breaks the key contract). Origin-less server-to-server calls are constrained by `allowedIps` (CIDR); a non-empty IP allowlist with an unattributable source fails closed. Empty `allowedIps` means no IP layer at all, which is why the CORS counterpart exists (`lib/server/open-api-cors.ts`: preflight only answers for an origin some enabled MACHINE client declares, never `*`, and `access-control-allow-credentials: false`).
- **Ruling 4 — per-key quota**: rate limit resolves per key (registered value > endpoint default > `DEFAULT_LIMIT {60, 60_000}`). Anonymous failures draw on a separate `open-api:unauthenticated:<ip|source-unattributed>` window whose size is a deployment number (`OPEN_API_UNAUTHENTICATED_LIMIT`, production default 20/min, raised in `.env.test` because every test file shares one unattributable source address). IP attribution trusts `x-forwarded-for` only under `RATE_LIMIT_TRUST_PROXY=true`, sharing the exact bucketing rule.
- **Ruling 5 — `/api/external/**` fully merged, no aliases**: the 8 machine endpoints now live under `/api/v1/open/**` (10 route handlers total, incl. `whoami` and the certificate lookup). The old routes are deleted with no deprecated aliases. The API is outward-facing and multi-Programme by construction: `Activity`↔`Programme` resolves only through an ACTIVE `SourceObjectMapping`, `Institution`↔`Programme` only through an ACTIVE `InstitutionRepresentation`, a null `ScopedRecord.programmeId` means personal and is unreachable outward, and every cross-tenant probe answers **404, never 403**.
- **Ruling 7 — audit attribution**: Open API writes carry the client identity and request id; asymmetric attribution (authenticated vs anonymous windows) is locked by unit test.
- **Ruling 6 — ADMIN registration page**: `/[locale]/admin/channel-clients` (`app/[locale]/admin/channel-clients/page.tsx` + `components/admin-channel-clients-manager.tsx`, menu entry under the ADMIN-only system module in `AdminShell`). It is a client of the four existing admin routes and adds **no server capability**: the page does not query `channelClient` at all, so the single "strip the digest columns" projection in `GET /api/admin/channel-clients` stays the only place that decides what the browser may see. Register / edit policy / rotate / revoke all require an in-app prompt for the reason (no `window.prompt`), the one-time plaintext is a read-only input that selects on focus, and a revoked row renders every control disabled. The list is server-paginated and server-filtered (`programmeId`/`type`/`search` + `page`/`pageSize`, default 25 and max 100, response carries `pagination { page, pageSize, total, totalPages }`), so the panel never drags the whole registry into the DOM. Narrow screens were fixed twice: the first cut shipped a scoped `styles/features/admin-channel-clients.css` because a `<select>` cannot wrap and the widest programme option set the panel's min-content width, and the follow-up ruling 「统一收口」 deleted that file — the same physics applies to every admin page, so the rules now live in the shared layer `styles/shared/extended-components.css` (`minmax(0, 1fr)` grid tracks, `min-width: 0` containers, `max-width: 100%` controls, `.table-scroll`, `overflow-wrap: anywhere`), which also cleared the pre-existing 446px overflow on `/admin/messages`.
- Evidence: `tests/open-api-auth.test.mjs` (21), `tests/channel-client-auth.test.mjs` (10), `tests/external-decision-receipts.test.mjs` (12), `tests/source-ref-contracts.test.mjs` (6), `tests/admin-channel-clients-page.test.mjs` (10), `tests/admin-narrow-viewport-css.test.mjs` (5), plus real-DB matrices `tests/api/open-api-key-api.test.ts`, `source-activity-mapping-api.test.ts`, `source-ref-contracts-api.test.ts`, `external-decision-receipts-api.test.ts` and the registry pagination matrix in `channel-client-auth-api.test.ts`. Browser: `tests/e2e/admin-channel-clients.spec.ts` (5 — access gate, register→use→re-policy→rotate→revoke golden path, scope hard gate, server-side pager, four-viewport two-state overflow check) and `tests/e2e/admin-narrow-viewport.spec.ts` (34 ADMIN routes measured at 360px in one pass). Gates: 610/610 Node, API 168 cases (162 pass, 0 fail, 6 explicit data-dependent skips), e2e 43 pass + 14 pre-existing explicit skips / 0 fail, `tsc --noEmit` clean, lint clean. Contract↔route parity is checked by `node artifacts/check-openapi.mjs` (10/10).
- Path references to `/api/external/decision-receipts`, `/api/external/activity-taxonomy` and `POST /api/external/source-refs` in the dated 2026-09-19/20 sections above are kept as written history; the live paths are the `/api/v1/open/**` equivalents listed above.
- Migration state, re-verified 2026-09-21: `node scripts/migration-dry-run.mjs` applies all **45** migrations to a scratch database from empty (118 tables, `prisma validate` green, scratch dropped). Dev is still intentionally at 44/45.

### Previously verified local baseline

Current working tree: `/Users/rr/Projects_AD/climatepassport`, HEAD `f1035c2`, with substantial existing uncommitted work. See [requirements/implementation gaps](REQUIREMENTS_IMPLEMENTATION_GAP_AUDIT_20260918.md) and [remaining development plan](DEVELOPMENT_REQUIREMENTS_AND_PLAN_20260918.md). Sections below include historical implementation notes, not blanket acceptance of every endpoint.

Agent handoff: development resumed after CP-TODO-227 and CP-TODO-228 (durable batch issuance) is now implemented for its bounded local scope and verified in the isolated real DB suite; see the [Certificate Phase 1 handoff](AGENT_HANDOFF_20260918_CERTIFICATE_PHASE1.md) and [execution plan](DEVELOPMENT_REQUIREMENTS_AND_PLAN_20260918.md). Continue from CP-TODO-229.

- Current local verification: 366/366 Node tests; 23 API tests with 16 pass and 7 explicit skips for unimplemented placeholder flows; 41 browser tests with 27 pass and 14 explicit data/capability skips; TypeScript, lint, production build, Prisma validation and all 31 local migrations pass. Browser execution is serial because the suite shares one isolated database and Next dev compiler.
- Phase 1 CP-TODO-224~227 has focused rule/snapshot/lifecycle/PDF tests plus real DB/browser certificate acceptance. Production renderer/storage infrastructure and deployment are not implied by local acceptance.
- Activity authorization, legacy check-in convergence, export disclosure and rate-limit source stability P0 blockers are resolved locally. This is not production deployment evidence.
- Bounded core issuance paths now create privately stored real PDFs with configured assets/layout, physical page sizes, embedded Noto Sans SC subsets and a unique scannable verification QR. Download counters, UTF-8 filenames, immutable verification identity, lifecycle provenance/concurrency and dependency deletion guards are fixed locally; legacy HTML reads remain for backward compatibility.
- Durable batch issuance (CP-TODO-228) is implemented locally: additive `20260918030000_certificate_batch_issuance` models batches/items with idempotency keys, per-item status/attempts/leases and a per-item unique batch-issue correlation; server-side preflight reports malformed/duplicate/existing rows before confirmation; Activity eligible lists are server-derived (participation COMPLETED/CERTIFIED); bounded chunk processing with compare-and-set claims, failure reconcile (links the already-created certificate instead of reissuing) and exactly-one in-app notification per newly issued item. Single issuance and edit/reissue were refactored into a shared service without behavior change. The legacy one-request email-list endpoint remains for compatibility only.
- Certificate categories, templates, applications and records have substantive implementation. Issuing rules now persist only the bounded supported Activity check-in trigger; Course, Learning Experience, Points and manual-review triggers remain explicitly unavailable pending their own accepted service contracts.
- Public portfolio now uses consent-based revocable tokens; legacy UUID/Passport ID profile lookup remains 404. Person/Institution compatibility models already exist locally.
- Summer-school behavior remains frozen. No production deployment, commit or push is part of this review.

## Decision Addendum: 2026-09-22

This dated addendum does not revalidate the older implementation inventory below. [Partner Identity And Trust Requirements](PARTNER_IDENTITY_AND_TRUST_REQUIREMENTS.md) adds requirements, not shipped functionality:

- Pending: partner opt-in provisioning, verified account claim/first password setup, consent evidence, safe existing-account linkage, and independent password ownership.
- Pending: independent institution/activity trust assessments, versioned reward eligibility, admin policy operations, scoped partner APIs, and correction/revocation impact handling.
- Existing email/reset primitives are only a starting point. The current reset endpoint requires `ACTIVE`; ordinary registration's `PENDING` handling is not an accepted secure partner claim flow. Partner lifecycle and concurrency acceptance tests are required before reuse.
- Blockchain anchoring: retained long-term, explicitly excluded from the current development plan, not an implementation blocker or current backlog task.
- No business code, database schema, API, or page changed as part of this requirements update.

## 1. Implemented

### Repository And App Foundation

- npm workspace root with `apps/*` and `packages/*`.
- `apps/passport-web` Next.js 14 App Router app.
- Shared TypeScript baseline.
- `packages/passport-contracts` provides versioned v1 SHCW bridge and public certificate schemas; `passport-sdk` consumes them for typed v1 wrappers.
- `packages/passport-core` now contains first shared Core rules for Passport ID, opaque token helpers, QR token hashing, certificate verification codes, and channel bridge target path validation.
- `packages/passport-sdk` now contains a first client skeleton for bridge issue/exchange helpers and public certificate verification.
- V1 SHCW API routes are fail-closed by `CHANNEL_SHCW_ENABLED`, preserve legacy bridge routes, use atomic bridge services, and return minimum-disclosure certificate verification only. This is code-level only, not a production integration claim.

### Database And Data Layer

- Prisma schema with PostgreSQL datasource.
- Phase 3A local-only additive migration `20260913060000_portfolio_phase3a` adds fixed competency dimensions, versioned constrained rules, owner consent, and hashed revocable share links. It was applied locally; this is not a production deployment claim.

### Verified Portfolio And Sharing (Phase 3A)

- Request-time derivation accepts only issued certificates, approved platform-verified achievements, qualifying completed learning participation, and verified activity participation.
- The owner dashboard supports consent scope, policy acknowledgement, one-time displayed token creation, revocation, safe link lifecycle status, and JSON export.
- Public token API/page share one atomic cap/expiry/revocation resolver and emit a minimal noindex projection. Legacy UUID/Passport-ID profile credentials lookup returns 404.
- Deferred: provider/LMS apply, jobs, recruitment/matching, AI scoring, DID/VC, partner search, generic uploads, public directories and bulk export.
- Migration baseline exists under `prisma/migrations/20260522000000_baseline`.
- QR/verifier/audit migration exists under `prisma/migrations/20260523000000_qr_verifier_audit`.
- Seed script exists at `prisma/seed.mjs`.
- Server Prisma loader exists in `apps/passport-web/lib/server/prisma.ts`.
- Local-only `20260913030000_activity_checkin_certificate_issuance` adds durable bounded Activity QR issuance reservations. It is code/local-migration evidence only, not a production deployment claim; legacy Event/direct routes, general rules, jobs, email, PDF, and object storage remain deferred.
- Phase 2A external-learning evidence boundary is implemented locally with `20260913050000_external_learning_evidence_phase2a`: DRAFT-by-default provider configuration, opaque account/course mappings, bounded ADMIN inspection APIs, and an idempotent raw-body HMAC inbox receipt. It stores no raw payload or secret and deliberately performs no normalization or application of learning outcomes.
- Phase 4 internal redemption accounting foundation is implemented locally with additive migrations `20260913110000_redemption_accounting_phase4` and corrective `20260913111000_redemption_accounting_user_available`: server-only intents and balanced journals/postings, serializable bounded retries, idempotency, owner/admin service authorization, and transactional audit/in-app metadata. `USER_AVAILABLE` is accounting representation only; until ledger cutover, availability remains legacy `User.points` minus outstanding reserved credits. It does not change `User.points` or `PointTransaction`, expose UI/APIs, or call a provider. All commerce/provider capabilities remain deferred and gated in `REDEMPTION_ACCOUNTING_PHASE4_SPEC.md`.
- Phase 4 Activity AI content drafts are implemented in code with locally applied additive migration `20260913120000_activity_ai_content_drafts`. The default-disabled ADMIN-only UI/API creates isolated zh/en summary/highlights/overview-copy drafts from bounded public title/subtitle/summary/description only. Native-fetch OpenAI configuration has no fallback/retry; generated output never alters Activity, and only explicit ADMIN approval plus publish confirmation writes locale-correct public fields. This is not production provider configuration, deployment, chat/RAG, matching/scoring/recommendation, moderation decision, profiling, upload, or browsing evidence; security/privacy/provider approval remains required.

### Auth And Session

- Email normalization.
- bcrypt password hashing.
- Login/register/logout/session APIs.
- HTTP-only session cookie.
- Prisma session lookup.
- Role-based route guard helpers.
- Code-level configurable rate limiting is implemented for critical mutations and public verification. `RATE_LIMIT_MODE` supports local, shared, or auto operation; proxy headers require explicit `RATE_LIMIT_TRUST_PROXY`; a shared REST backend requires `RATE_LIMIT_REST_URL` and `RATE_LIMIT_REST_TOKEN`. Production deployment/configuration validation remains pending.

### Current Routes And Pages

- Public web routes: home, about, events, speakers, certificates, contact, FAQ, privacy, terms.
- Locale routes under `[locale]`.
- Auth routes: login and register.
- Dashboard routes: overview, Climate Passport, learning experiences, messages, notifications, summer school.
- Admin routes: events, learning experiences, learning applications, certificates, summer school applications.
- All localized `/[locale]/admin/**` pages now receive one shared `AdminShell` from `app/[locale]/admin/layout.tsx`, with module-level primary navigation, module-owned secondary menus, active state, and role-aware visibility. Event managers have the permitted Activity Center/check-in/scanner scope; reward rules, certificate rules, form templates, global organizer management, Certificate Hub, and achievement/badge moderation remain ADMIN-only. Verifiers use `/{locale}/verifier`, not admin routes. Production UI/manual E2E validation remains pending.
- Summer school application route.
- Certificate routes now include user list/detail and public verification page shells: `/[locale]/dashboard/certificates`, `/[locale]/dashboard/certificates/[id]`, `/verify/certificate/[code]`.
- Certificate Applications Phase 1 is implemented in code with a locally applied additive migration (`20260913020000_certificate_applications_phase1`): user request/edit/resubmit/withdraw and history, admin review, and approval-linked issuance/audit/in-app notification. It has no attachments, external email, background jobs, rules, or production deployment claim.

### Current APIs

- Auth APIs.
- Dashboard notifications and contact message APIs.
- Admin events APIs.
- Admin certificates issue API.
- Learning experience public/admin APIs.
- Summer school application APIs.
- Channel session bridge issue/exchange APIs.
- ADMIN-only external-learning provider, account, and course-mapping APIs plus bounded inbox/evidence read APIs; the inbound provider-neutral webhook is receipt-only and inactive unless an ACTIVE provider has production prerequisites.

### Domain Coverage In Prisma

- User, Account, Session, VerificationToken.
- Organization.
- Event, Track, Institution, EventInstitution, EventVerifier, EventDateSlot.
- Registration, Wishlist, CheckIn, PointTransaction.
- Speaker, SpeakerRole, AgendaItem.
- InvitationRequest, SpecialPass.
- ContactMessage, NotificationPreference, Notification.
- AchievementDefinition, UserAchievement, PassportMilestone.
- CertificateCategory, CertificateTemplate, CertificateDefinition, CertificateIssue, CertificateVerification.
- ChannelSessionBridge.
- QrToken and CoreAuditLog.
- LearningExperienceCategory, Program, Stage, Application, Participation, ProgramEventLink.
- SummerSchoolApplication.
- ExternalLearningProvider, ExternalLearningAccount, ExternalLearningCourseMapping, ExternalLearningInboxEvent, and ExternalLearningEvidence.

### Learning Experiences

- Domain modeled separately from Event.
- Program, application, stage, participation, and event link models exist.
- User draft/save/submit APIs exist.
- Admin status transition APIs exist.
- Participation sync exists in first form.

### Certificate Hub

- Phase 1 record lifecycle completion is code-level implemented: the ADMIN-only records page uses bounded server-side pagination and filtering, deterministic ordering, artifact view/print, verification-link copy, and status-conditional revoke/restore/regenerate actions. Revocation requires a reason; regeneration preserves persisted manual variables and the verification code; post-mutation audit writes are best effort. No external object storage, production deployment, or renderer service is claimed.

- Prisma models exist for category, template, definition, issue, verification.
- `CERTIFICATE_MODULE_PRODUCT_REQUIREMENTS.md` is now the current Certificate module PRD and development plan.
- Certificate Hub admin pages should sit inside the Certificate Hub secondary menu in this order: overview, records, issue, applications, categories, templates, rules, audit logs. They should not be flattened into the global admin primary menu.
- Admin certificate issue API exists.
- Admin certificate issue API exists and uses opaque verification codes.
- Public certificate verification API exists.
- Authenticated certificate download authorization and download count tracking API exists.
- Admin certificate revocation API exists.
- User certificate list/detail UI and public verify UI are now runnable in first version.
- User certificate list has search, category filter, and status filter.
- Certificate detail public profile visibility toggle is persisted through `CertificateIssue.publicVisible`.
- Public credential display is now through consent-based portfolio token sharing, constrained by visibility and current evidence validity; the legacy identifier-based profile route returns 404.
- Certificate download and visibility changes write Core audit logs.
- Admin records/issue/templates/categories/applications/rules/audit pages now have first route/page shells in place.
- Full external file storage, rule automation depth, admin action completeness, richer public profile publishing controls, and productized audit analytics remain pending.
- Production execution of the legacy password migration (`scripts/migrate-legacy-password-hashes.mjs`) after dry-run review; do not treat code hardening as production migration completion.

### Phase Execution (P0-P2, 2026-05-23)

- P0: fixed certificate rules page Prisma select mismatch that blocked `npm run build`.
- P0: aligned summer-school duplicate lookup behavior with form UX (email OR passport ID match).
- P0: credential hardening for CP-FR-001 / fail-closed password requirement: removed plaintext verification fallback in `apps/passport-web/lib/server/auth.ts`; `prisma/seed.mjs` now writes bcrypt hashes; `scripts/import-shcw-core.mjs` validates full bcrypt verifier format before persistence; added one-off `scripts/migrate-legacy-password-hashes.mjs` with `--dry-run`/`--apply`, conditional `updateMany`, and conflict reporting. Production data migration remains a pending deployment action (dry-run → review → `--apply` → confirm zero non-bcrypt rows).
- P0: local password migration preflight completed with `npm run migrate:passwords:dry-run`: 1,124 users scanned, with 1,124 valid bcrypt verifiers and zero legacy, blank, or malformed values. The result is local-environment evidence only and does not confirm production status.
- P1: added cross-module admin quick-link panels on events and learning-experiences admin pages to improve discoverability.
- P2: extracted summer-school lookup filter helper and added regression tests in `tests/summer-school-lookup.test.mjs`.

### Channel Session Bridge

- One-time token issue API exists.
- One-time token exchange API exists.
- Token hashes are persisted.
- Expiry and consumed timestamp exist.
- Exchange uses a conditional database update so concurrent requests cannot consume one bridge token more than once.
- Successful exchanges and rejected replay/expired exchanges write Core audit logs.
- Bridge target paths are allowlisted.
- Issue/exchange APIs have configurable shared-aware rate limiting; local mode exists, while stable-source key hardening and production shared-backend validation remain pending.

### QR And Verifier

- Opaque QR token model exists.
- Identity QR issue API exists.
- Event check-in QR issue API exists.
- Verifier scan API exists for identity validation and event check-in.
- Verifier scan writes Core audit logs and enforces event-specific verifier access.
- Verifier scanner UI is implemented at `/[locale]/verifier` with camera-based QR scanning (BarcodeDetector) and manual token fallback, gated by ADMIN / EVENT_MANAGER / VERIFIER roles.
- Event-only Invitation / Special Pass QR issuance, revocation, expiry, single-use admission, and opaque audit correlations are implemented. Migration `20260913000000_invitation_special_pass_event_phase0` was applied locally only, not in production.
- Activity verifier authorization now uses explicit `ActivityVerifier` assignments, with Activity ownership enforcement for event managers. Activity invitation/pass QR issuance and scanning are still not implemented; production deployment and E2E validation remain pending.

### Runtime API Regression Coverage (Phase 0 Core API)

- The runtime mocked-route regression package now covers the Core API routes executed in Node with module mocks:
  - Auth: login, register, forgot-password, reset-password, verify-email request/confirm, session, logout.
  - Channel bridge: unversioned issue/exchange, v1 issue/exchange, v1 public certificate verify.
  - QR / verifier: identity QR issue (`qr/identity`) and verifier scan (`verifier/scan`) for identity validation and invitation/special-pass dispatch.
  - Certificate lifecycle: admin revoke/restore, owner/admin download authorization and download count, artifact delivery authorization, public minimum-disclosure verify.
  - Parameterized admin RBAC for certificate issue/revoke/restore/regenerate across ADMIN, EVENT_MANAGER, VERIFIER, and ATTENDEE.
- The 2026-09-13 regression snapshot reported **324 passing** tests; the 2026-09-18 earlier local check reported **330 passing**. Neither replaces complete authenticated browser E2E or production configuration validation.

## 2. In Progress / Partial

- QR Code issuing and verifier APIs now exist as a minimum server-side closed loop; signed/encrypted token wrappers and rotation policy remain partial.
- Verifier scanner UI is now available; signed/encrypted token wrappers and key rotation still need implementation.
- Admin and Web are currently in one app and need target split planning.
- Certificate Hub has issue, verify, download count, and revoke APIs; records lifecycle UI is complete at code level. External file storage, production deployment, and broader notification/rule work remain pending.
- Learning Experience completion now writes back participation completion, certificate issue when configured, points, point ledger, and milestones. Cohort operations and deeper reviewer workflow remain partial.
- Channel bridge replay attempts are audited; operational replay metrics and production shared-rate-limit configuration remain pending.
- Points and milestones writeback exist for Learning Experience completion; broader achievement rules and productized UI remain partial.
- Certificate user/admin surfaces are now available in first phase, but operational depth (filters, batch workflows, persistence toggles, richer actions) remains partial.
- External learning Phase 2A stops at trusted receipt and operator configuration. Phase 2B requires an approved provider, production secret manager, worker/parsing contract, and reconciliation policy. Phase 2C requires separate reviewed-apply approval; automatic completion, certificates, points, badges, achievements, and outbound sync are not implemented.

## 3. Pending

- QR key rotation and signed/encrypted wrapper support.
- Public verification under `verify.climatepassport.org`.
- Minimum necessary public verification disclosure policy in UI/API.
- Person and Institution Core Master Data model evolution beyond current `Speaker` / `Institution` schema.
- `apps/passport-admin` extraction.
- `apps/passport-api` extraction.
- `packages/passport-core` domain service extraction.
- `packages/passport-ui` replacement for the older `passport-ui-flows` direction.
- Certificate rendering/storage and user/admin UI expansion.
- Embedded flow contracts.
- Production deployment/configuration validation and full API/E2E regression tests for auth, event registration, QR, verifier, certificate lifecycle, and channel bridge.

# Person / Institution compatibility master data (Phase 3, local development)

The additive schema package `20260913070000_person_institution_master_data_phase3` introduces `Person`, `PersonAffiliation`, `PersonRoleProfile`, verification/role enums, a nullable `Speaker.personId` compatibility link, and additive `Institution` governance/verification/alias/parent/contact fields. It has been applied locally only and is not a production deployment claim.

- `scripts/backfill-speaker-persons.mjs` defaults to `--dry-run` and deterministically creates one `Person` + `SPEAKER` role profile per unlinked `Speaker`; `--apply` runs inside a retry-wrapped transaction. No fuzzy/email/name/User/Institution/Organization matching is performed.
- ADMIN-only APIs exist for people list/create/detail/update, affiliations list/create, role profiles list/create, institution list/detail/governance update, and explicit speaker person link/unlink.
- ADMIN-only admin pages `/[locale]/admin/people` and `/[locale]/admin/institutions` sit under the current shared `AdminShell`, with search/list/detail/edit/link flows and zh/en labels.
- Existing public Speaker/Institution presentation flows are unchanged. Recruitment, matching, partner search, public directory, AI, DID/VC, and background jobs remain deferred.

## 4. Deprecated / Superseded

- Year-based or sequential Passport IDs.
- Channel-prefixed Passport IDs such as SHCW-specific IDs.
- Plain URL QR as the trusted payload.
- QR payloads containing personal data in cleartext.
- SHCW-local ownership of Core identity, registration, verifier, certificate, points, achievements, milestones, QR, or participation records.
- Treating verifier split as an open near-term app decision.
- Treating Web/Admin split as undecided target architecture.

## 5. Current Development Priorities

Phase 0 security/test baseline (CP-TODO-218 through 223) completed locally on 2026-09-18. Evidence includes 337 unit tests, isolated API execution, non-skipped auth/role browser flows and real-database Activity authorization/check-in/export assertions. Existing placeholder tests for unimplemented redemption endpoints are not counted as passed functionality.

1. Complete remaining certificate workflows: review depth and reliable audit (229 through 230); 224 through 228 are locally accepted.
2. Verify all eight certificate admin modules against the prototype body and desktop/mobile behavior (237); do not recreate existing page skeletons.
3. Harden Learning Experience completion/rewards and validate actual SHCW integration; externally sourced learning application remains gated (231, 232, 235, 236).
4. Accept consent-based portfolio and Person/Institution operations with real workflow evidence (233, 234).
5. Stabilize Core contracts, plan incremental extraction and complete release gates without automatic deployment (239, 238). Activity invitation/pass expansion remains separately scoped.
# Certificate Phase 1 safety (local code status)

Category/template lifecycle guards and immutable issuance render snapshots are implemented in code. The additive snapshot migration is applied to local development and isolated test databases only; production status, object storage deployment, jobs, durable batch notifications and CSV remain out of scope.
## Activity QR certificate issuance (Phase 1)

Local-only migration `20260913030000_activity_checkin_certificate_issuance` adds durable issuance reservations. Automatic issuance is limited to successful authoritative `ACTIVITY_CHECKIN` scans through `POST /api/verifier/scan`, for unconditional eligible rules only. New accepted issuance uses the shared real-PDF builder and private artifact adapter. Legacy Event check-ins, direct activity check-in routes, tasks, submissions, learning experiences, points, jobs, email and all other triggers remain deferred.
# Certificate artifact storage (Phase 1, local development)

New bounded core issuance artifacts are real PDFs stored through private provider-neutral local or authenticated HTTP metadata. The renderer embeds only required Noto Sans SC subsets and does not fetch arbitrary remote assets. The migration is local-only; production durable volume/HTTP adapter deployment, renderer runtime, retention, legacy backfill/purge and background retries remain release work.
# 2026-09-13 — controlled PROJECT application (local-only)

Implemented and locally migrated `20260913080000_project_application_consent_phase3`: additive Activity disclosure flags and one-to-one ProjectApplicationConsent. PROJECT submit/review/withdraw/view guards, field-level portfolio/profile disclosure, safe audit/in-app notification, localized consent/reviewer UI, and idempotent approval participation are code-level complete. This is local-only and is not production rollout evidence. Interest-only applications, team applications, jobs/recruitment/candidate or institution search, matching, AI, and a public applicant directory remain explicitly unimplemented.
