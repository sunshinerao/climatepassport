# Climate Passport Platform Pending Features Tracker

Last updated: 2026-09-18

## Status Legend

- `todo`: not started
- `doing`: in progress
- `done`: completed
- `blocked`: blocked by dependency or decision
- `external`: removed from CP development scope; independently owned by a programme, not CP pending work or CP completion

`done` below can mean the explicitly bounded code/local increment, not end-to-end or production acceptance. Historical test counts retain their dates; the latest reviewed local snapshot is 350 Node tests / 30 migrations, plus 8 passing API tests (7 explicit skips) and 26 passing browser tests (14 explicit skips). Current gaps and evidence limits are in [the 2026-09-18 audit](REQUIREMENTS_IMPLEMENTATION_GAP_AUDIT_20260918.md).

## Multi-programme Development Intake (2026-09-18)

Current scope and acceptance: [functional requirements V2](CLIMATE_PASSPORT_FUNCTIONAL_REQUIREMENTS_V2.md); sources/code reconciliation: [programme synthesis](PROGRAMME_REQUIREMENTS_SYNTHESIS_20260918.md). The following are new requirements, not completed implementation. Existing 218~239 work remains valid; programme releases share safety gates but do not all wait for every optional certificate capability. Summer-school behavior stays frozen. V2 section 10 defines each dependency and test gate.

Boundary correction V2.1: programme business systems are independently developed outside CP. Items 254/255/256 are external ownership records, excluded from CP backlog/progress; the other 17 items are narrowed to shared services and CP-side integration. Joint acceptance does not authorize CP to build programme workspaces, rules or operations modules.

- [ ] CP-TODO-240 `todo` freeze Core/external field ownership, scoped contracts and reuse ADR; no programme business rule packages; CP-FR-050/053/071.
- [ ] CP-TODO-241 `todo` implement Tenant/Programme/Edition scopes and object-level role/consent authorization with cross-programme/edition negative tests; CP-FR-050/051.
- [ ] CP-TODO-242 `todo` extend Person claim and institutional representation/revocation/merge aliases without assuming affiliation grants authority; reuse 234; CP-FR-051/052.
- [ ] CP-TODO-243 `todo` separate channel user and machine authentication, scoped contracts/SDK, client registration and real environment tests; reuse 235; CP-FR-069/073.
- [ ] CP-TODO-244 `todo` deliver reliable outbox/inbox, idempotency/revision receipts, failure queues and reconciliation, prioritizing withdrawal/cancellation; CP-FR-070.
- [ ] CP-TODO-245 `todo` add unique source-edition activity mappings, source-owned field revisions and publication/cancellation, preserving Event/Activity history; CP-FR-053.
- [ ] CP-TODO-246 `todo` generic occurrences, multi-role assignments, external taxonomy references, atomic admission/waitlist and attendance correction; no programme-specific recruitment/classification rules; CP-FR-054/055/056.
- [ ] CP-TODO-247 `todo` generic private record/revision/object-access APIs, not Inquiry/ActionPlan business models or pages; CP-FR-057/071.
- [ ] CP-TODO-248 `todo` controlled Asset upload/finalize/scanning, immutable evidence/media versions and inherited derivative access; CP-FR-058.
- [ ] CP-TODO-249 `todo` purpose/channel/version consent, verified guardian links, necessary coauthor/material permissions and withdrawal; real youth enablement requires approved policy; CP-FR-060.
- [ ] CP-TODO-250 `todo` validate and retain minimal external decision/revocation receipts by issuer, scope, object version and purpose; business review/appeal queues remain external; CP-FR-059.
- [ ] CP-TODO-251 `todo` publication read gate, immutable-version projections, immediate withdrawal and restoration protection; CP-FR-061/068.
- [ ] CP-TODO-252 `todo` generic sourceRef/schema contract and CP-side FS integration example/tests; FS builds its own Lab/learning/editorial system; CP-FR-071/072.
- [ ] CP-TODO-253 `todo` person/institution contribution facts, evaluated verification levels, corrections and existing record/portfolio adapters without duplicate rewards; CP-FR-062.
- CP-TODO-254 `external` Convener membership/seats/annual activation: developed by the Convener programme, removed from CP delivery; generic identity/grants remain in 242/241; CP-FR-064.
- CP-TODO-255 `external` Offer-Need/action plans/support tickets/SLA: developed by the Convener programme, removed from CP delivery; optional generic record/asset/notification APIs remain in 247/248/257; CP-FR-065.
- CP-TODO-256 `external` Credit/Standing/business appeals: developed by the Convener programme, removed from CP delivery; CP only accepts authorized minimal results via 250/253 and existing credentials; CP-FR-063.
- [ ] CP-TODO-257 `todo` notification retry/preferences, privacy-safe reports, scoped exports/retention/deletion and backup-withdrawal replay; CP-FR-066/067/068.
- [ ] CP-TODO-258 `todo` CP-owned generic pages, SDK components and CP-side end-to-end integration tests; programme business workspaces/menus remain external; reuse 223/237; CP-FR-072/073.
- [ ] CP-TODO-259 `todo` source-test traceable joint acceptance, migration dry-runs, operations/recovery handover and per-programme release recommendation; no automatic deployment; CP-FR-073.

## Retained Security And Certificate Work (2026-09-18)

Detailed scope, FR mapping, dependencies, tests and exit gates: [development requirements and plan](DEVELOPMENT_REQUIREMENTS_AND_PLAN_20260918.md). Summer-school flows remain frozen.

- [x] CP-TODO-218 `done` 2026-09-18: isolated test DB/origin and explicit test mail outbox; runners do not load ordinary `.env`, reuse unknown servers or invoke commands through a shell. Generated mail is removed after the run.
- [x] CP-TODO-219 `done` 2026-09-18: Activity manager/verifier resource guards now cover list/detail/mutation/batch/participation/task/submission/review/check-in/sync paths; actor and trusted asset fields are server-owned.
- [x] CP-TODO-220 `done` 2026-09-18: legacy QR POST redirects with method/body preservation to the authoritative scanner; direct privileged/self-task check-in uses session actor, eligibility, serializable mutation and duplicate protection.
- [x] CP-TODO-221 `done` 2026-09-18: source keys are stable opaque IP references and ignore UA; sensitive production auto/shared modes fail closed without a shared backend and shared calls have bounded timeout.
- [x] CP-TODO-222 `done` 2026-09-18: exports require exact Activity ownership, apply PROJECT name/email consent, exclude Passport ID/phone/review notes, neutralize spreadsheet formulas, disable caching and audit downloads.
- [x] CP-TODO-223 `done` 2026-09-18: non-skipped real DB/browser acceptance covers zh/en login, registration/logout, four role fixtures, recovery mail outbox and inactive-session invalidation; Passport ID collision retry remains covered by the core unit test.
- [x] CP-TODO-224 `done` 2026-09-18: artifact state/count writes are awaited; only successful attachments increment, inline/denied/missing responses do not; UTF-8 filenames retain an ASCII fallback; real DB owner/ADMIN/stranger and missing-file acceptance passes.
- [x] CP-TODO-225 `done` 2026-09-18: public verification reads immutable issued identity/variables, certificate application snapshots are complete, revocation provenance is persisted, lifecycle transitions use compare-and-set, and issued records/referenced category/template deletion is rejected. Real DB mutation, concurrency and disclosure acceptance passes.
- [x] CP-TODO-226 `done` 2026-09-18: static Active examples were replaced by persisted Activity check-in rules with create/rename/enable/disable/notify controls; compatibility entrances redirect to one API, execution checks persisted enablement, and unsupported Course/LE/Points/manual triggers remain explicitly unavailable.
- [x] CP-TODO-227 `done` 2026-09-18: core issuance/regeneration/application approval and Activity check-in create real `application/pdf` artifacts with configured layout/assets, physical A4 landscape/portrait or digital-card dimensions, embedded OFL-1.1 Noto Sans SC subsets and per-certificate QR. Private delivery, Unicode filenames, rendered-pixel and QR decode acceptance pass locally; production renderer/storage deployment and retention remain release gates, not claimed completion.
- [x] CP-TODO-228 `done` 2026-09-18: durable MANUAL_LIST/CSV/Activity-eligible batches with server-side preflight (malformed/duplicate/existing-issue rows reported before confirmation), idempotency-key replay, transactional batch/item creation, bounded chunk processing, compare-and-set item claims with expiring leases, issue-created/item-not-updated reconcile that links the existing certificate instead of reissuing, exactly-one in-app notification per newly issued item (zero when disabled), truthful per-item/aggregate failure states and retry-failed, plus batch create/process/retry/completion audit correlation. Activity eligibility is server-derived (participation COMPLETED/CERTIFIED) and ADMIN-authorized; other sources remain disabled. Evidence: 12 batch-service unit tests, 4 issuance-service unit tests, 8 real-DB API tests; full gates green (366 node, 16 API + 7 placeholder skips, 27 browser (41 total) + 14 explicit skips, lint/tsc/build/31 migrations).
- [ ] CP-TODO-229 `todo` Phase 1: application detail/history/review workflow acceptance; attachments require separately accepted private-storage and retention policy.
- [ ] CP-TODO-230 `todo` Phase 1: reliable critical audit persistence/recovery, batch correlations and truthful dashboard/log analytics.
- [ ] CP-TODO-231 `todo` Phase 2: LE cohort/reviewer and completion concurrency/recovery; no duplicate certificate/points/milestone and no summer-school migration.
- [ ] CP-TODO-232 `todo` Phase 2: trusted reward provenance, idempotency and approved reversal compensation; forbid client-set trusted outcomes.
- [ ] CP-TODO-233 `todo` Phase 3: consent-based portfolio real-flow acceptance, revocation/expiry/concurrent caps, evidence validity and private-cache isolation.
- [ ] CP-TODO-234 `todo` Phase 3: Person/Institution operations, Speaker compatibility and isolated backfill dry-run acceptance; production changes remain separate.
- [ ] CP-TODO-235 `todo` Phase 2: actual SHCW SDK/bridge journey and host/cookie/callback contracts; local dual-origin first, real environment separately accepted.
- [ ] CP-TODO-236 `blocked` Phase 2: external-learning normalization/reconciliation/reviewed application requires approved provider, parser and apply policy; continue independent internal work.
- [ ] CP-TODO-237 `todo` Phase 1: eight-module prototype-body fidelity, functional links, shared shell and 320/390/768/1440px hamburger/table/keyboard acceptance.
- [ ] CP-TODO-238 `todo` Phase 4: complete scoped release evidence, authenticated E2E, migration/restore exercises and production configuration review; no implicit deployment.
- [ ] CP-TODO-239 `todo` Phase 4: Core extraction ADR and stable shared contracts; preserve bounded community/redemption/AI safety gates instead of widening product scope.

Handoff note 2026-09-18 (updated): CP-TODO-228 is now implemented for the bounded local scope described above; the previous one-request `Promise.all` email list remains only as a legacy compatibility endpoint and the issue-page batch tab uses the durable batch APIs. Development continues at CP-TODO-229. No summer-school source or workflow is authorized.

### Historical ID Collision Repair

CP-TODO-194/195/196 had been reused for unrelated tasks. Keep the credential-hardening/production-password-migration/local-password-preflight meanings. The other tasks are reassigned below: certificate applications -> 214, v1 channel contracts -> 215, Activity check-in certificate issuance -> 216, private HTML artifact storage -> 217. Old references require matching the task title as well as the old ID. Repeated entries in the dated execution log refer to the same task, not extra deliverables.

## 1. Documentation And Governance

- [x] CP-TODO-046 `done` audit existing docs and classify current authority, historical notes, superseded docs, and archive candidates.
- [x] CP-TODO-047 `done` create current docs entrypoint and authority set.
- [x] CP-TODO-048 `done` codify Climate Passport Core vs SHCW Channel Shell boundary.
- [x] CP-TODO-049 `done` close old architecture decisions for verifier integration and Web/Admin/API/Verify split.
- [x] CP-TODO-095 `done` merge Certificate Hub notes and latest product input into `CERTIFICATE_MODULE_PRODUCT_REQUIREMENTS.md`.
- [x] CP-TODO-193 `done` publish `CLIMATE_PASSPORT_FUNCTIONAL_REQUIREMENTS_V1.md` as the Chinese V1 execution baseline for the Core trust loop, Core/SHCW boundary, requirements, delivery phases, and zh/en-only launch readiness.
- [x] CP-TODO-214 `done` implement Certificate Application Phase 1 code and apply additive migration locally only: independent application lifecycle, owner/admin APIs, atomic approval issuance provenance, audit, and in-app notification. Attachments, external email, jobs, rules, and production rollout remain excluded. Previously collided with CP-TODO-194.
- [x] CP-TODO-205 `done` Phase 3A verified portfolio local increment: explainable fixed dimensions, active constrained rules, owner consent/link lifecycle, hashed opaque public tokens and legacy profile hardening. Production rollout is not claimed.
- [ ] CP-TODO-206 `todo` future portfolio work: LMS/provider apply and reconciliation UX, DID/VC, background jobs, recruitment/matching, AI scoring, and any public directory require separate approval.
- [x] CP-TODO-209 `done` implement bounded Phase 4 internal-only redemption accounting foundation with local-only additive journal migrations (`20260913110000`, corrective `20260913111000`), approved USER_AVAILABLE/USER_RESERVED/CLEARING balanced lifecycle, idempotency, serializable retries, internal audit/notification metadata, and empty provider registry. Availability remains legacy User.points minus outstanding reserved credits until separately approved ledger cutover. No UI, offers, inventory, payment/money, webhook, worker, or outbound provider call.
- [x] CP-TODO-211 `done` implement bounded Phase 4 Activity AI content drafts in code with local-only migration `20260913120000_activity_ai_content_drafts`: default-disabled ADMIN-only exact-Activity/zh-en draft lifecycle, native-fetch single-provider boundary, bounded public-copy allowlist, sanitized metadata/audit, sensitive rate/daily limits, explicit approval/confirmation publication, and dry-run retention purge. No automatic publication, chat/RAG, matching/scoring/recommendation, moderation decision, profiling, upload, or browsing.
- [x] CP-TODO-213 `done` implement bounded Phase 0 Core API runtime regression test package: mocked route coverage for auth, channel bridge (v1/unversioned), QR/verifier, certificate lifecycle/artifact authorization/public minimum disclosure, and parameterized admin RBAC; 324 local tests pass. Does not replace deployed browser E2E or production configuration validation.
- [ ] CP-TODO-212 `blocked` production Activity AI enablement requires provider/security/privacy approval, production secret management, shared sensitive-rate-limit validation, retention operations, human-review training, deployment review, and browser/E2E verification; production migration/provider configuration is not claimed.
- [ ] CP-TODO-210 `blocked` redemption fulfillment requires separately approved provider selection/contracts, offer and inventory ownership, secret management, payment/legal review, reconciliation/refund policy, worker/webhook threat model, UI/API scope, and production migration review.
- [x] CP-TODO-207 `done` implement bounded Phase 3 Person/Institution compatibility master-data package in code with local-only additive migration `20260913070000_person_institution_master_data_phase3`: Person, PersonAffiliation, PersonRoleProfile, Speaker.personId link, Institution governance/verification/alias/parent/contact fields, deterministic speaker backfill (dry-run/`--apply`), ADMIN-only APIs and admin pages under the shared shell, and Node regression tests. Production migration, recruitment/matching/partner search/public directory/AI/DID/VC remain deferred.
- [ ] CP-TODO-208 `todo` production Person/Institution migration: review dry-run output, run `npm run backfill:speakers:apply`, confirm Speaker.personId coverage, and only then treat the migration as production-complete. Public directory, partner discovery, and recruitment/matching surfaces remain separately gated.
- [x] CP-TODO-215 `done` add bounded v1 SHCW Core contracts, fail-closed channel resolver, bridge/verification routes, and typed SDK wrappers. SHCW UI, partner credentials/CORS/domains, production enablement, and external E2E remain deferred. Previously collided with CP-TODO-195.
- [x] CP-TODO-216 `done` implement bounded Activity QR check-in certificate issuance in code with locally applied `20260913030000_activity_checkin_certificate_issuance`: authoritative unified scanner only, unconditional eligible rules, durable reservation, reproducible snapshot, transactional audit/notification. Legacy Event/direct routes, general rules, jobs/email/PDF/object storage, and production rollout remain deferred. Previously collided with CP-TODO-195.
- [x] CP-TODO-217 `done` code/local-only private certificate HTML artifact storage via `20260913040000_certificate_artifact_storage_phase1`; provider-neutral local/generic authenticated HTTP adapter, authorized delivery, and legacy-inline compatibility exist. Counter persistence and real PDF rendering were subsequently completed by 224/227; production volume/adapter configuration, retention and legacy migration remain pending. Previously collided with CP-TODO-196.
- [x] CP-TODO-197 `done` implement local/code-only Phase 2A provider-neutral external-learning evidence boundary via `20260913050000_external_learning_evidence_phase2a`: DRAFT-by-default providers, opaque ADMIN account/course mapping management, signed raw-body HMAC receipt, replay/idempotency and bounded operator reads. No raw payload/secrets, normalization, completion application, or vendor enablement.
- [ ] CP-TODO-198 `blocked` Phase 2B requires provider selection, production secret-manager resolver, shared sensitive limiter, approved worker/parser and reconciliation policy; Phase 2C reviewed application is separately gated and automatic rewards/writeback remain prohibited.
- [ ] CP-TODO-050 `todo` add a lightweight docs update checklist to future PR workflow.

## 2. Platform Foundation

- [x] CP-TODO-001 `done` define target bounded contexts for identity, events, participation, Passport identity, certificate, learning experience, verifier, QR, and channel delivery.
- [x] CP-TODO-002 `done` draft target repository architecture and deployment topology for Climate Passport.
- [x] CP-TODO-003 `done` decide target Web/Admin/API/Verify split.
- [x] CP-TODO-021 `done` codify migration preservation rules for mature flows while superseding SHCW-local ownership.
- [x] CP-TODO-025 `done` define Certificate Hub bounded context and linkage to points, achievements, and milestones.
- [x] CP-TODO-051 `done` create first `packages/passport-core` implementation for Passport ID, opaque token helpers, certificate verification code helpers, and channel bridge target validation.
- [ ] CP-TODO-052 `todo` create extraction plan for `apps/passport-admin`.
- [ ] CP-TODO-053 `todo` create extraction plan for `apps/passport-api`.
- [ ] CP-TODO-054 `todo` replace or evolve `packages/passport-ui-flows` into `packages/passport-ui`.

## 3. Passport ID And QR

- [x] CP-TODO-055 `done` document Passport ID principles, anti-patterns, QR types, payload guidance, signing/encryption rules, verification flow, rotation, expiry, privacy, security, and open questions.
- [x] CP-TODO-056 `done` finalize Passport ID format as no-prefix `XXXXXXX-XXXXXX` using 13 random uppercase Crockford Base32 characters excluding ambiguous characters.
- [x] CP-TODO-057 `done` implement Passport ID generation as a Core service with tests and UUID/CUID internal ID separation.
- [x] CP-TODO-058 `done` design and implement opaque token issuing for Passport QR with privacy settings respected in the first identity QR API.
- [x] CP-TODO-059 `done` design and implement short-lived opaque token issuing for Event Check-in QR with expiration, server validation, audit log, and server-side validation.
- [x] CP-TODO-060 `done` design and implement public verification URL plus opaque verification code for Certificate Verification QR.
- [x] CP-TODO-061 `done` implement Event-only opaque, single-use Invitation / Special Pass QR issuance, revocation, expiry, verifier admission, and opaque audit correlations. Activity verifier authorization is code-level complete (explicit `ActivityVerifier` assignment plus organizer ownership), but Activity invitation/pass QR issuance and scanning are not implemented. Local migration `20260913000000_invitation_special_pass_event_phase0` was applied locally only, not in production; production deployment/E2E and shared rate-limit configuration remain pending.
- [ ] CP-TODO-062 `doing` implement QR decode/verify service with key rotation support (server-side opaque token decode exists; key rotation remains pending).
- [x] CP-TODO-063 `done` add first QR privacy and security regression tests for opaque helper and target path behavior.
- [x] CP-TODO-092 `done` decide QR offline authentication is not required at this stage.
- [x] CP-TODO-093 `done` define minimum necessary disclosure for `verify.climatepassport.org`.

## 4. Verifier And Check-In

- [x] CP-TODO-064 `done` decide verifier remains inside Climate Passport Core for current stage.
- [x] CP-TODO-065 `done` design independent verifier API contract for SHCW and future shells as `/api/verifier/scan`.
- [x] CP-TODO-066 `done` unified verifier resource checks, legacy redirect and direct Activity check-in authorization/eligibility are covered by unit and real-database browser acceptance under CP-TODO-219/220.
- [x] CP-TODO-067 `done` implement Event Check-in QR validation and attendance confirmation.
- [x] CP-TODO-068 `done` implement verification logs for verifier outcomes through CoreAuditLog.
- [x] CP-TODO-069 `done` add scanner UI or embedded verifier flow. Implemented at `/[locale]/verifier` with camera (BarcodeDetector) and manual fallback.
- [ ] CP-TODO-070 `doing` code-level configurable shared-aware rate limiting is complete for verifier and critical mutation APIs, with `RATE_LIMIT_MODE`, `RATE_LIMIT_TRUST_PROXY`, `RATE_LIMIT_REST_URL`, and `RATE_LIMIT_REST_TOKEN`; production shared-backend configuration and deployment validation remain pending.

## 5. Data Migration And Continuity

- [x] CP-TODO-004 `done` inventory source SHCW tables, enums, and critical relationships.
- [x] CP-TODO-005 `done` define source-to-target mapping for users, speakers, events, registrations, and check-ins.
- [x] CP-TODO-006 `done` design migration strategy for preserving existing IDs and historical timestamps.
- [x] CP-TODO-007 `done` prepare first migration script against a database snapshot.
- [x] CP-TODO-023 `done` document module migration matrix for what moves to Climate Passport versus what stays in the SHCW shell.
- [x] CP-TODO-028 `done` draft the first Prisma schema covering phase-one platform domains and Certificate Hub.
- [x] CP-TODO-029 `done` add server-side data loader layer for passport-web routes.
- [x] CP-TODO-030 `done` scaffold dry-run migration bootstrap script.
- [x] CP-TODO-031 `done` wire passport-web server loaders to Prisma with safe fallback.
- [x] CP-TODO-032 `done` add Prisma seed baseline.
- [x] CP-TODO-033 `done` add source extraction script for SHCW users, events, and registrations.
- [x] CP-TODO-034 `done` add target import pipeline for tracks, users, events, and registrations.
- [x] CP-TODO-035 `done` extend migration pipeline to event verifiers, checkins, point transactions, invitation requests, and special passes.
- [x] CP-TODO-036 `done` extend migration pipeline to institutions, speakers, speaker roles, agenda items, and speaker-agenda links.
- [x] CP-TODO-037 `done` wire passport-web to render real speakers and agenda data from migrated database.
- [x] CP-TODO-038 `done` add Passport-owned static info pages plus messages and notifications surfaces.
- [x] CP-TODO-071 `done` decide Speaker and Institution are long-term Core Master Data consumed by SHCW as presentation read models.
- [x] CP-TODO-094 `done` design and implement Person, Institution, role profile, affiliation, and Speaker compatibility models as Core master data; preserve existing SHCW/Event/Activity speaker/institution presentation flows. See Phase 3 package in `docs/PERSON_INSTITUTION_MASTER_DATA_PHASE3_PLAN.md`.
- [ ] CP-TODO-072 `todo` add migration validation checks for Passport ID, check-in, points, certificates, and participation continuity.

## 6. Identity And Access

- [x] CP-TODO-008 `done` design and implement Passport-native auth and session model.
- [x] CP-TODO-009 `done` define and implement SHCW shell channel session bridge token issue/exchange APIs.
- [x] CP-TODO-010 `done` define first runnable role gates for attendee, admin, and event manager access.
- [ ] CP-TODO-073 `doing` password reset and email verification code exists; complete isolated mail-backed browser/API acceptance and verify deployment email configuration under CP-TODO-223/238.
- [ ] CP-TODO-074 `doing` bridge allowlist, shared-aware limiter, SDK helpers, atomic consumption and replay audit exist; stable rate keys, operational metrics, shared-backend deployment and real channel journey remain pending (221/235/238).
- [x] CP-TODO-194 `done` harden credential storage and verification for CP-FR-001 / fail-closed password requirement: removed plaintext verification fallback in `apps/passport-web/lib/server/auth.ts`; `prisma/seed.mjs` persists bcrypt hashes; `scripts/import-shcw-core.mjs` validates full bcrypt verifier format before persistence; added `scripts/migrate-legacy-password-hashes.mjs` with `--dry-run`/`--apply`, conditional `updateMany`, and conflict reporting.
- [ ] CP-TODO-195 `todo` execute the production legacy password migration using `scripts/migrate-legacy-password-hashes.mjs`: run dry-run against production, review the count, run `--apply`, confirm zero non-bcrypt rows, and only then mark the migration complete. The code hardening in CP-TODO-194 is not a production migration.
- [x] CP-TODO-196 `done` run the local password migration preflight: `npm run migrate:passwords:dry-run` scanned 1,124 local users with zero legacy, blank, or malformed password values. This is not production migration evidence.

## 7. Core Domain Modules

- [x] CP-TODO-011 `done` define people hub models for users, speakers, moderators, institutions, and organizations in the current schema.
- [x] CP-TODO-012 `done` define event hub models for events, agenda, venues, tracks, institutions, and visibility in the current schema.
- [x] CP-TODO-013 `done` define participation models for registration, invitation, attendance, check-in, verifier assignment, and special pass in the current schema.
- [x] CP-TODO-014 `done` define passport ledger models for points, achievements, milestones, and certificates in the current schema.
- [x] CP-TODO-026 `done` define Certificate Hub models for category, definition, template, issue, approval, verification, and download lifecycle.
- [x] CP-TODO-027 `done` define how mature existing logic and accepted UI stay preserved during migration without preserving superseded architecture decisions.
- [ ] CP-TODO-075 `doing` implement Core service layer for event registration and check-in rules (event check-in verifier API exists; registration rules remain pending).
- [ ] CP-TODO-076 `doing` implement Core service layer for certificate issue, revoke, verify, and download rules (bounded APIs and private real-PDF artifacts exist; complete recovery, production storage/renderer rollout and remaining orchestration are pending).
- [ ] CP-TODO-077 `doing` implement Core service layer for points, achievements, and milestones writeback (unified point-ledger service and approved-achievement point writeback shipped across register/profile/check-in/certificate pathways; milestone rule orchestration remains pending).

## 8. Certificate Hub

- [x] CP-TODO-078 `done` model certificate categories, templates, definitions, issues, verification records, and Passport linkage.
- [ ] CP-TODO-079 `doing` configured rendering, immutable snapshots and private real-PDF artifacts exist for bounded core issuance; remaining prototype fidelity, recovery and production storage/renderer acceptance are tracked by CP-TODO-230/237 and release gates.
- [x] CP-TODO-080 `done` implement certificate public verification flow.
- [x] CP-TODO-081 `done` download authorization, persisted counters, UTF-8 filenames and real DB owner/ADMIN/stranger assertions are complete under CP-TODO-224.
- [x] CP-TODO-082 `done` implement certificate revocation.
- [ ] CP-TODO-083 `doing` connect certificate issue to points, achievements, and milestones according to definition rules (Learning Experience completion linkage shipped; general certificate rule engine pending).
- [x] CP-TODO-096 `done` implement `/dashboard/certificates` user certificate list with overview, filters, search, cards, download, share, and verification actions.
- [x] CP-TODO-097 `done` implement `/dashboard/certificates/[id]` certificate detail with preview, metadata, capability tags, QR verification area, share actions, and public profile visibility toggle.
- [x] CP-TODO-098 `done` implement `/verify/certificate/[code]` public verification UI with minimum necessary disclosure.
- [x] CP-TODO-099 `done` implement `/admin/certificates/records` bounded server-paginated/filterable list with status, verification count, artifact view/print, revoke/restore/regenerate, and verification-link copy actions. Notification and external storage are not part of this completed bounded phase.
- [ ] CP-TODO-100 `doing` single and email-list batch issue UI exist; complete lifecycle entrance consistency, durable CSV/source-list batches and real acceptance (225/228).
- [ ] CP-TODO-101 `doing` template configuration, images, typography, preview and bounded real-PDF rendering exist; complete prototype fidelity and browser operations under CP-TODO-237, not another skeleton.
- [ ] CP-TODO-102 `doing` category CRUD and dependency guards exist; accept effective service policy and complete browser operations (225/237).
- [ ] CP-TODO-103 `doing` independent certificate application lifecycle and approval issuance exist; complete detail/history/reviewer UX and real workflow tests (229).
- [ ] CP-TODO-104 `doing` persisted Activity check-in rules and bounded auto-issuance exist; broader supported triggers depend on CP-TODO-231/232/236 and must remain unavailable until their contracts are accepted.
- [ ] CP-TODO-105 `doing` implement `/admin/certificates/audit-logs` verification, download, admin operation, revocation, template modification, and batch issue logs (first verification/admin audit view plus download/visibility audit writes shipped; deeper analytics pending).
- [x] CP-TODO-106 `done` historical identifier-based public credentials page is superseded: retain 404, use CP-TODO-205 consent-based `/{locale}/portfolio/[token]`; remaining acceptance tracked by CP-TODO-233. This entry must not authorize restoring public identifier lookup.
- [x] CP-TODO-107 `done` add certificate module regression tests for issue, verify, download, revoke, public disclosure, artifact authorization, and admin RBAC boundaries. API-level mocked-route coverage is in place and passing; deployed browser E2E and production configuration validation remain pending.

## 9. Learning Experiences

- [x] CP-TODO-042 `done` formalize Learning Experiences as independent Program/Application domain linked to Event and Passport.
- [x] CP-TODO-044 `done` complete first runnable Learning Experiences user/admin closed loop.
- [ ] CP-TODO-084 `todo` define migration compatibility from existing Summer School artifacts into Learning Experience domain.
- [ ] CP-TODO-085 `todo` implement deeper cohort operations and reviewer workflow.
- [ ] CP-TODO-086 `doing` implement completion, certificate, points, achievements, and milestone writeback (completion certificate, points, ledger, and milestones shipped; achievements pending).
- [ ] CP-TODO-087 `todo` define how LE-owned ceremonies or sessions link to Event without flattening LE into Event registration.

## 10. Channel Delivery

- [x] CP-TODO-088 `done` define SHCW Shell boundary and integration principles.
- [ ] CP-TODO-015 `todo` define read APIs for SHCW branded content surfaces that require Core data.
- [ ] CP-TODO-016 `todo` define themed transaction flow strategy for login, register, apply, dashboard, verifier, and verification views.
- [ ] CP-TODO-017 `todo` define channel configuration model for branding, copy, route wrappers, and targetPath allowlists.
- [ ] CP-TODO-022 `todo` define how SHCW shell reuses accepted flows without owning Core logic.
- [ ] CP-TODO-089 `doing` implement SHCW shell SDK helpers for session bridge and embedded flows (bridge and certificate verification SDK skeleton shipped; embedded flows pending).
- [ ] CP-TODO-090 `todo` add end-to-end integration tests across Passport and SHCW shell environments.

## 11. Productization And Rollout

- [x] CP-TODO-039 `done` implement live register/login/logout/session APIs and session-aware dashboard routing.
- [x] CP-TODO-040 `done` deliver role-aware admin event management.
- [x] CP-TODO-041 `done` switch dashboard messages and notifications to persisted per-user models.
- [x] CP-TODO-043 `done` add notification preference mutation and contact message submit APIs.
- [x] CP-TODO-045 `done` ship first SHCW-aligned visual and copy productization pass.
- [ ] CP-TODO-018 `todo` design phased cutover plan from SHCW monolith to Climate Passport platform.
- [ ] CP-TODO-019 `doing` runtime mocked-route regression checks for login, channel bridge (unversioned and v1), Passport QR, verifier, certificate lifecycle, and admin RBAC are implemented and passing (324 tests). Full browser/E2E and production configuration validation remain pending.
- [ ] CP-TODO-020 `todo` define launch criteria for independent Climate Passport deployment.
- [ ] CP-TODO-091 `todo` define deployment plan for `www`, `admin`, `api`, and `verify` domains.
- [x] CP-TODO-114 `done` implement the shared `app/[locale]/admin/layout.tsx` AdminShell for all localized admin routes: module-level primary menu, module-owned secondary menus, active state, and role-based visibility. Certificate Hub secondary order remains overview, records, issue, applications, categories, templates, rules, audit logs; Summer School remains an ADMIN-only temporary Learning Experiences child. Event managers have permitted Activity Center/check-in/scanner navigation, while rules/configuration, global organizers, Certificate Hub, and achievement/badge moderation remain ADMIN-only; Verifiers use `/{locale}/verifier`. Production UI/manual E2E validation remains pending; no deployment is claimed.

## 12. Phase Execution Log (2026-05-23 – 2026-09-13)

- [x] CP-TODO-194 `done` Phase 0 credential hardening (CP-FR-001 / fail-closed password requirement): removed plaintext password verification fallback, switched seed to bcrypt hashes, added bcrypt validation to SHCW core import, and delivered one-off migration script with dry-run/`--apply`, conditional `updateMany`, and conflict reporting.
- [ ] CP-TODO-195 `todo` Production legacy password migration: run `npm run migrate:passwords:dry-run` against production, review the reported count, run `npm run migrate:passwords:apply`, and confirm zero non-bcrypt rows remain before considering the migration complete.


- [x] CP-TODO-108 `done` phase P0 unblock: fixed certificate rules Prisma select mismatch and restored successful workspace build.
- [x] CP-TODO-109 `done` phase P0 behavior fix: aligned summer-school duplicate lookup API with form UX by supporting email-or-passport-id matching.
- [x] CP-TODO-110 `done` phase P1 navigation hardening: added cross-module admin quick-link panels on events and learning-experiences admin pages.
- [x] CP-TODO-111 `done` phase P2 test scaffolding: extracted summer-school lookup filter helper and added regression tests in `tests/summer-school-lookup.test.mjs`.
- [x] CP-TODO-112 `done` phase P2 expansion: extended automated coverage from helper-level tests to API permission boundaries and certificate lifecycle end-to-end cases. Runtime mocked-route package passes 324 tests; browser/E2E and production configuration validation remain pending.
- [x] CP-TODO-113 `done` certificate profile visibility persistence: added `CertificateIssue.publicVisible`, owner/admin visibility API, public profile filtering, and migration `20260523001000_certificate_public_visibility`.
- [x] CP-TODO-115 `done` topbar action visual consistency: unified right-side header control height baseline for login/register, account trigger, and locale switcher in `apps/passport-web/app/globals.css`.
- [x] CP-TODO-116 `done` fr/de locale enablement: wired locale-specific dictionaries for `fr` and `de` in `apps/passport-web/lib/site-content.ts` and switched `getDictionary` from fallback-only behavior to locale return.
- [x] CP-TODO-117 `done` home hero text refinement: increased left text column width, enlarged hero subtitle by 20%, and added hover tooltip annotation for the term "气候时代" in `apps/passport-web/components/platform-screens.tsx` and `apps/passport-web/app/globals.css`.
- [x] CP-TODO-118 `done` homepage first-screen spacing polish: removed extra top whitespace on locale home route by adding `page-home` class override in `apps/passport-web/components/site-shell.tsx` and `apps/passport-web/app/globals.css`.
- [x] CP-TODO-119 `done` hero text sizing correction: clarified requirement to increase only hero text-container width by 25% and reduce the line "属于你的气候时代的可信档案" font size by 20% in `apps/passport-web/app/globals.css`.
- [x] CP-TODO-120 `done` hero structure refresh: updated homepage hero to 6:4 layout, locked zh title to single-line adaptive sizing, removed italic styling from "气候时代" with left-aligned tooltip, and replaced right-side static card with auto-looping media showcase.
- [x] CP-TODO-121 `done` hero tooltip spacing refinement: kept "气候时代" inherited color, doubled zh hero title-to-subtitle spacing, and ensured tooltip keeps fixed width with wrapped text while remaining left-aligned.
- [x] CP-TODO-122 `done` hero term color update: changed "气候时代" term color to gold accent (`var(--amber-warm, #c4893f)`) in homepage zh hero title.
- [x] CP-TODO-123 `done` hero zh subtitle copy refresh: replaced zh subtitle with two-line copy and preserved consistent size/color/style between both lines with normal line spacing.
- [x] CP-TODO-124 `done` hero zh description upgrade: replaced zh hero description copy, set "Climate Passport" to gold accent, and added hover tooltip with bilingual explanatory content.
- [x] CP-TODO-125 `done` hero zh main title update: changed zh hero headline to "为气候时代构建可信数字身份基础设施。" while keeping existing tooltip, color accents, and layout unchanged.
- [x] CP-TODO-126 `done` hero zh title size adjustment: reduced the updated zh hero headline adaptive font size by 30% across desktop and mobile breakpoints.
- [x] CP-TODO-127 `done` hero lower-copy sizing pass: reduced the two text blocks below the zh hero headline (`hero-subtitle` and `hero-desc`) by about 10% with matching mobile adjustments.
- [x] CP-TODO-128 `done` hero multilingual headline alignment: set EN homepage headline to the approved definition and aligned FR/DE headline translations to equivalent meaning in `apps/passport-web/lib/site-content.ts`.
- [x] CP-TODO-129 `done` hero cross-locale visual parity: unified EN/FR/DE hero headline keyword color, hover tooltip behavior, and adaptive title size strategy with zh implementation.
- [x] CP-TODO-130 `done` hero multilingual copy parity: aligned EN/FR/DE subtitle and description content with zh semantics using explicit locale copy blocks in `apps/passport-web/components/platform-screens.tsx`.
- [x] CP-TODO-131 `done` hero tooltip locale parity: localized `Climate Passport` hover tooltip content for `en/fr/de` instead of reusing mixed zh/en text.
- [x] CP-TODO-132 `done` hero brand spacing parity: added one explicit space between `Climate Passport` and the following description text across all locales.
- [x] CP-TODO-133 `done` locale switch order update: swapped zh/en positions in the main locale switcher and Summer School locale switcher while keeping other language ordering unchanged.
- [x] CP-TODO-134 `done` hero stats strip scale-down: reduced the stats background block height by ~15% and stat number font-size by ~15% on desktop and mobile.
- [x] CP-TODO-135 `done` metric definition correction: changed homepage "Passport holders" metric from total user count to Climate Passport holder count (`climatePassportId` non-null), without active-status filtering.
- [x] CP-TODO-136 `done` home third-section alignment: updated How It Works content and card-based layout styling to match provided screenshot direction.
- [x] CP-TODO-137 `done` how-it-works title block alignment: set label/title/description to centered vertical stack, matched title size to Hero title scale, and unified `Climate Passport` typography with page English font style.
- [x] CP-TODO-138 `done` how-it-works text spacing sync: aligned third-section three-line header spacing with Hero text block spacing scale.
- [x] CP-TODO-139 `done` how-it-works spacing precision fix: removed inherited/default heading/paragraph margin interference and pinned three-line spacing to Hero-equivalent 16px/20px values.
- [x] CP-TODO-140 `done` how-it-works spacing final adjustment: changed second-to-third line gap from 20px to 16px, making both gaps 16px.
- [x] CP-TODO-141 `done` section-4/5 header format sync: aligned Events and Features three-line header format with section-three style (vertical centered stack and 16px line gaps).
- [x] CP-TODO-142 `done` section-5 tail whitespace fix: removed homepage-only extra gap between Features section and footer by overriding adjacent footer top margin.
- [x] CP-TODO-143 `done` section-3 card style sync: refined hover lift motion, resized step-number circles, aligned step titles with section-4 card titles, and aligned step body text size with Hero description text.
- [x] CP-TODO-144 `done` section-5 card expansion: added three new feature cards and updated all six card contents to match screenshot-provided structure and copy direction.
- [x] CP-TODO-145 `done` section-5 tail gap selector correction: switched homepage footer gap override from `.proto-home + .site-footer` to `.page-home + .site-footer` to match actual shell DOM and fully align whitespace under section five.
- [x] CP-TODO-146 `done` section-5 tail gap root-cause fix: removed inherited `.page` bottom padding (`96px`) on homepage via `.page-home { padding-bottom: 0; }`.
- [x] CP-TODO-147 `done` footer section update: refreshed footer navigation/info/contact content and simplified footer bottom copy to the requested copyright line.
- [x] CP-TODO-148 `done` footer copyright alignment: right-aligned the copyright block and removed the Climate Passport item from footer navigation.
- [x] CP-TODO-149 `done` homepage section padding reduction: halved the outer top/bottom padding for sections 3/4/5 and updated responsive paddings proportionally.
- [x] CP-TODO-150 `done` homepage card-description gap reduction: reduced the spacing between section descriptions and card grids in sections 3/4/5 to about 60% of the current mobile values.
- [x] CP-TODO-151 `done` homepage card-description gap fixed: set the spacing between section descriptions and card grids in sections 3/4/5 to a fixed 30px.
- [x] CP-TODO-152 `done` homepage section 4/5 gap fine-tune: tightened only the section-description-to-cards spacing in sections 4 and 5 while leaving section 3 at 30px.
- [x] CP-TODO-153 `done` homepage hero top whitespace fix: restored `.page-home` top padding to 0 inside the mobile breakpoint so the Hero does not regain top space.
- [x] CP-TODO-154 `done` homepage section 4/5 description no-wrap fit: shortened Events and Features description copy so the centered text blocks stay on one line on the current mobile width.
- [x] CP-TODO-155 `done` home and app amber text unification: switched homepage stats and footer headings to the same primary amber text color as Hero accents.
- [x] CP-TODO-156 `done` home section 4 title apostrophe fix: corrected the Events heading from a literal `&apos;` string to a normal apostrophe in `Discover What's Next`.
- [x] CP-TODO-157 `done` certificate verification metadata and policy alignment: added expired-result support, derived issuer/related-source metadata from stored certificate variables, persisted Learning Experience variable values, and hid certificate details for blocked anonymous verification requests.
- [x] CP-TODO-158 `done` certificate verification multilingual route wiring: added locale-aware public verification routes, added `/{locale}/verify` query entry redirects, and kept legacy `/verify/**` links backward-compatible via redirect.
- [x] CP-TODO-159 `done` frontend style boundary strategy formalization: documented long-term style boundary split model (Foundation/Shared/Feature/Legacy), boundary rules, phased migration roadmap, and acceptance criteria in `docs/climate-passport-development-specification.md`.
- [x] CP-TODO-160 `done` homepage style boundary first split: moved homepage-only `.proto-home` and `.page-home` rules out of `apps/passport-web/app/globals.css` into `apps/passport-web/app/styles/features/home.css` and kept behavior unchanged via ordered import.
- [x] CP-TODO-161 `done` certificate verify style split: moved `.cpv-*` styles from `apps/passport-web/app/globals.css` into `apps/passport-web/app/styles/features/certificate-verify.css` with import-based loading.
- [x] CP-TODO-162 `done` certificate admin style split: moved `.cpca-*` styles and admin cpca typography normalization from `apps/passport-web/app/globals.css` into `apps/passport-web/app/styles/features/certificate-admin.css` with import-based loading.
- [x] CP-TODO-163 `done` certificate user style split: moved `.cpu-*` styles from `apps/passport-web/app/globals.css` into `apps/passport-web/app/styles/features/certificate-user.css` and wired import-based loading.
- [x] CP-TODO-164 `done` certificate public profile style split: moved `.cpp-*` styles from `apps/passport-web/app/globals.css` into `apps/passport-web/app/styles/features/certificate-profile.css` and wired import-based loading.
- [x] CP-TODO-165 `done` verifier console style split: moved `proto-verifier-*` styles from `apps/passport-web/app/globals.css` into `apps/passport-web/app/styles/features/verifier-console.css` and wired import-based loading.
- [x] CP-TODO-166 `done` summer school admin style split: moved `.ssa-*` styles from `apps/passport-web/app/globals.css` into `apps/passport-web/app/styles/features/summer-school-admin.css` and wired import-based loading.
- [x] CP-TODO-167 `done` prototype alignment v3 style split: moved the `Prototype alignment v3` style block from `apps/passport-web/app/globals.css` into `apps/passport-web/app/styles/features/prototype-alignment-v3.css` and wired import-based loading.
- [x] CP-TODO-168 `done` summer school application style split (phase 1): moved the main Task 3 `.ss-*` block from `apps/passport-web/app/globals.css` into `apps/passport-web/app/styles/features/summer-school-application.css` with import-based loading; responsive `.ss-*` overrides remain in globals for the next redistribution step.
- [x] CP-TODO-169 `done` dashboard redesign style split (phase 1): moved the main Task 5 `.dash-*` and dashboard card/feed block from `apps/passport-web/app/globals.css` into `apps/passport-web/app/styles/features/dashboard-redesign.css` with import-based loading; responsive `.dash-*` overrides remain in globals for the next redistribution step.
- [x] CP-TODO-170 `done` landing page style split (phase 1): moved the main Task 1 landing block from `apps/passport-web/app/globals.css` into `apps/passport-web/app/styles/features/landing-page.css` with import-based loading; responsive `.landing-*` overrides remain in globals for the next redistribution step.
- [x] CP-TODO-171 `done` admin certificate management style split (phase 1): moved the main Task 4 admin certificate management block from `apps/passport-web/app/globals.css` into `apps/passport-web/app/styles/features/admin-certificate-management.css` with import-based loading; responsive `.cert-mgr-*` overrides remain in globals for the next redistribution step.
- [x] CP-TODO-172 `done` enhanced registration form style split (phase 1): moved the main Task 2 registration enhancement block from `apps/passport-web/app/globals.css` into `apps/passport-web/app/styles/features/enhanced-registration-form.css` with import-based loading; responsive `.field-row*` overrides remain in globals for the next redistribution step.
- [x] CP-TODO-173 `done` responsive overrides redistribution (phase 2): moved the `Responsive overrides for new components` section out of `apps/passport-web/app/globals.css` into module-owned feature stylesheets (`landing-page`, `summer-school-application`, `dashboard-redesign`, `admin-certificate-management`, `enhanced-registration-form`) while preserving breakpoints and behavior.
- [x] CP-TODO-174 `done` remaining large globals extraction: moved `Extended component system` into `apps/passport-web/app/styles/shared/extended-components.css` and moved `Prototype alignment overrides` into `apps/passport-web/app/styles/features/prototype-alignment-overrides.css`, with import-based loading and regression checks passed.
- [x] CP-TODO-175 `done` shared footer extraction: moved footer implementation styles from `apps/passport-web/app/globals.css` into `apps/passport-web/app/styles/shared/footer.css` and switched to import-based loading while preserving behavior.
- [x] CP-TODO-176 `done` shared certificate foundation extraction: moved the large `certificate-*` foundation block (including its responsive rules) from `apps/passport-web/app/globals.css` into `apps/passport-web/app/styles/shared/certificate-foundation.css` with import-based loading and regression checks passed.
- [x] CP-TODO-177 `done` visual regression unblock (certificate verify CSS): during page-level regression validation, fixed an unclosed comment in `apps/passport-web/app/styles/features/certificate-verify.css` that caused Next.js build failure and restored route rendering.
	- [x] CP-TODO-178 `done` responsive regression fix (header/tooltip/key): fixed mobile header clipping with new topbar breakpoints, constrained homepage hero tooltips to viewport-safe widths, and resolved certificate verification duplicate React keys in `platform-screens.tsx`.
	- [x] CP-TODO-179 `done` homepage whitespace rebalance (isolated): reduced homepage Hero top spacing and section-5 bottom spacing via `apps/passport-web/app/styles/features/home.css` only, and enforced `.page.page-home` override so home spacing changes do not alter other pages.
	- [x] CP-TODO-180 `done` home-navigation spacing state drift fix: replaced route-header-dependent homepage spacing hook with structural selector (`.page:has(.proto-home)`), stabilizing spacing behavior across client navigation and browser refresh.
	- [x] CP-TODO-181 `done` homepage interaction/detail refinement: left-aligned hero hover tips (`气候时代` / `Climate Passport`), enforced readable hover state for the Hero `探索活动` button, and aligned section-5 tail spacing with section-4.
	- [x] CP-TODO-182 `done` homepage events-card hover/readability + section tail parity: applied home-scoped readable hover/focus styles for `近期活动` card `了解更多` buttons and explicitly aligned section-5/section-6 bottom spacing across responsive breakpoints.
	- [x] CP-TODO-183 `done` mobile navigation + home heading scale parity: switched topbar primary navigation to hamburger collapse on mobile and corrected home Hero + section 3/4/5/6 title scaling so headings remain proportionally larger than subtitle/body on small screens.
	- [x] CP-TODO-184 `done` climate-passport profile refinement: moved role badge inline with name, added green-to-gold profile completion ring progression, introduced tabbed `/dashboard/profile` maintenance (excluding email/name edits) with secure password change API, and expanded point-threshold achievement synchronization/rendering.
	- [x] CP-TODO-185 `done` profile form UX hardening: changed salutation to select options, aligned phone and country in one row with keyboard-searchable country dropdown, added avatar upload+preview+reupload with file constraints, and added strict organization website URL validation in client+API.
	- [x] CP-TODO-186 `done` profile required-field alignment and avatar constraint tightening: aligned profile maintenance required fields with registration (`phone`/`country`/`organization`), added required UI markers, and reduced avatar max file size to 500KB with synchronized client/API validation.
	- [x] CP-TODO-187 `done` ISO country/region source unification: introduced shared locale-aware country options helper (full ISO region coverage with fallback), and aligned both registration + profile maintenance forms to the same keyboard-searchable datalist source.
	- [x] CP-TODO-188 `done` profile upload and country selector UX polish: replaced native file-input visual with themed avatar upload trigger + filename display, and replaced browser-dependent datalist with explicit searchable country combobox panel in registration/profile forms.
	- [x] CP-TODO-189 `done` country selector efficiency optimization: implemented ordering strategy (`current selection first + preferred countries + remaining list`) and prioritized prefix matches during search in both registration and profile forms.
	- [x] CP-TODO-190 `done` profile website validation + climate-passport visual alignment: hardened organization website validation rules in client/API, centered profile completion percentage with global numeric typography, and aligned role badge baseline with hero name.
	- [x] CP-TODO-191 `done` achievement-badge implementation blueprint baseline: published detailed development blueprint covering schema migrations, API/page rollout, style-boundary constraints, regression acceptance, and push-ready no-omission checklist.
	- [x] CP-TODO-192 `done` achievement-badge blueprint delivery phase-1: delivered achievement/badge schema + migration, user/admin/verify APIs, dashboard/admin pages, navigation wiring, and trigger integration for register/profile/certificate/check-in flows.
# Certificate Phase 1 safety

Completed in local code: side-effect-free category reads, guarded category/template lifecycle and deletion, inactive server-side copies, active-chain issuance guard, immutable render snapshots, private real-PDF artifacts and bounded browser E2E. Still pending: production migration/deployment plus storage/renderer validation, jobs, remaining notifications, durable CSV batches and full module fidelity acceptance.
# 2026-09-13 — Controlled PROJECT Interest & Application

- [x] Additive local-only consent schema/migration, owner/admin-only PROJECT review, consent-scoped disclosure, audit/notification, and idempotent approval participation.
- [ ] Production migration/deployment and browser/E2E operational verification.
- [ ] Deliberately deferred: interest-only submission, team applications, jobs/recruitment/candidate search, institution browsing, matching, AI, and public applicant directory.
# Phase 4 activity community (bounded foundation)
- [x] Optional per-activity PREMODERATED community for PROJECT and CHALLENGE only.
- [x] Participant-scoped posts, single-level comments, reports, explicit membership roles, and organizer/admin/explicit-moderator moderation authorization.
- [x] No global feed, social graph, chat/DM, directory, search, uploads, or AI surfaces.
- [x] Privacy notice: `ACTIVITY_COMMUNITY_PRIVACY_NOTICE.md`.
