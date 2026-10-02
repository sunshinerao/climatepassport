# Current Implementation Status

Product baseline: [Climate Passport 最高开发指导纲领](CP_MASTER_DEVELOPMENT_DIRECTIVE.md). This file records implementation evidence and gaps; it does not override the master directive or establish completion by restating requirements.

Last updated: 2026-10-02 (authority reference merged; implementation evidence remains dated per section)

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
