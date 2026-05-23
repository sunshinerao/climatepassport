# Climate Passport Platform Pending Features Tracker

Last updated: 2026-05-23

## Status Legend

- `todo`: not started
- `doing`: in progress
- `done`: completed
- `blocked`: blocked by dependency or decision

## 1. Documentation And Governance

- [x] CP-TODO-046 `done` audit existing docs and classify current authority, historical notes, superseded docs, and archive candidates.
- [x] CP-TODO-047 `done` create current docs entrypoint and authority set.
- [x] CP-TODO-048 `done` codify Climate Passport Core vs SHCW Channel Shell boundary.
- [x] CP-TODO-049 `done` close old architecture decisions for verifier integration and Web/Admin/API/Verify split.
- [x] CP-TODO-095 `done` merge Certificate Hub notes and latest product input into `CERTIFICATE_MODULE_PRODUCT_REQUIREMENTS.md`.
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
- [ ] CP-TODO-061 `todo` design and implement opaque token issuing for Invitation / Special Pass QR.
- [ ] CP-TODO-062 `doing` implement QR decode/verify service with key rotation support (server-side opaque token decode exists; key rotation remains pending).
- [x] CP-TODO-063 `done` add first QR privacy and security regression tests for opaque helper and target path behavior.
- [x] CP-TODO-092 `done` decide QR offline authentication is not required at this stage.
- [x] CP-TODO-093 `done` define minimum necessary disclosure for `verify.climatepassport.org`.

## 4. Verifier And Check-In

- [x] CP-TODO-064 `done` decide verifier remains inside Climate Passport Core for current stage.
- [x] CP-TODO-065 `done` design independent verifier API contract for SHCW and future shells as `/api/verifier/scan`.
- [x] CP-TODO-066 `done` implement verifier permission checks based on verifier identity and event-specific access.
- [x] CP-TODO-067 `done` implement Event Check-in QR validation and attendance confirmation.
- [x] CP-TODO-068 `done` implement verification logs for verifier outcomes through CoreAuditLog.
- [ ] CP-TODO-069 `todo` add scanner UI or embedded verifier flow.
- [ ] CP-TODO-070 `doing` add abuse controls and rate limits for verifier APIs (bridge rate limits exist; verifier distributed abuse controls remain pending).

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
- [ ] CP-TODO-094 `todo` design Person, Institution, role profile, event assignment, and partner role model evolution.
- [ ] CP-TODO-072 `todo` add migration validation checks for Passport ID, check-in, points, certificates, and participation continuity.

## 6. Identity And Access

- [x] CP-TODO-008 `done` design and implement Passport-native auth and session model.
- [x] CP-TODO-009 `done` define and implement SHCW shell channel session bridge token issue/exchange APIs.
- [x] CP-TODO-010 `done` define first runnable role gates for attendee, admin, and event manager access.
- [ ] CP-TODO-073 `todo` add password reset and email verification flows if required for launch.
- [ ] CP-TODO-074 `doing` harden session bridge with targetPath allowlist, rate limit, replay metrics, and SDK helper (allowlist, in-memory rate limits, and SDK helper shipped; replay metrics remain pending).

## 7. Core Domain Modules

- [x] CP-TODO-011 `done` define people hub models for users, speakers, moderators, institutions, and organizations in the current schema.
- [x] CP-TODO-012 `done` define event hub models for events, agenda, venues, tracks, institutions, and visibility in the current schema.
- [x] CP-TODO-013 `done` define participation models for registration, invitation, attendance, check-in, verifier assignment, and special pass in the current schema.
- [x] CP-TODO-014 `done` define passport ledger models for points, achievements, milestones, and certificates in the current schema.
- [x] CP-TODO-026 `done` define Certificate Hub models for category, definition, template, issue, approval, verification, and download lifecycle.
- [x] CP-TODO-027 `done` define how mature existing logic and accepted UI stay preserved during migration without preserving superseded architecture decisions.
- [ ] CP-TODO-075 `doing` implement Core service layer for event registration and check-in rules (event check-in verifier API exists; registration rules remain pending).
- [ ] CP-TODO-076 `doing` implement Core service layer for certificate issue, revoke, verify, and download rules (first APIs exist; rendering/storage remain pending).
- [ ] CP-TODO-077 `doing` implement Core service layer for points, achievements, and milestones writeback (Learning Experience completion points and milestones shipped; broader achievement rules remain pending).

## 8. Certificate Hub

- [x] CP-TODO-078 `done` model certificate categories, templates, definitions, issues, verification records, and Passport linkage.
- [ ] CP-TODO-079 `todo` implement certificate template rendering and file storage strategy.
- [x] CP-TODO-080 `done` implement certificate public verification flow.
- [x] CP-TODO-081 `done` implement certificate download authorization and download count tracking.
- [x] CP-TODO-082 `done` implement certificate revocation.
- [ ] CP-TODO-083 `doing` connect certificate issue to points, achievements, and milestones according to definition rules (Learning Experience completion linkage shipped; general certificate rule engine pending).
- [x] CP-TODO-096 `done` implement `/dashboard/certificates` user certificate list with overview, filters, search, cards, download, share, and verification actions.
- [x] CP-TODO-097 `done` implement `/dashboard/certificates/[id]` certificate detail with preview, metadata, capability tags, QR verification area, share actions, and public profile visibility toggle.
- [x] CP-TODO-098 `done` implement `/verify/certificate/[code]` public verification UI with minimum necessary disclosure.
- [ ] CP-TODO-099 `todo` implement `/admin/certificates/records` certificate records list with status, verification count, revoke, restore, download, notification, link copy, and log entry actions.
- [ ] CP-TODO-100 `todo` implement `/admin/certificates/issue` manual issue UI for single user and first batch-oriented issue flow.
- [ ] CP-TODO-101 `todo` implement `/admin/certificates/templates` and `/admin/certificates/templates/[id]` with configuration form and preview placeholder.
- [ ] CP-TODO-102 `todo` implement `/admin/certificates/categories` category management.
- [ ] CP-TODO-103 `todo` implement `/admin/certificates/applications` user certificate application review workflow.
- [ ] CP-TODO-104 `todo` implement `/admin/certificates/rules` automatic issuing rules for course, event, Learning Experience, role, points, achievement, and milestone triggers.
- [ ] CP-TODO-105 `doing` implement `/admin/certificates/audit-logs` verification, download, admin operation, revocation, template modification, and batch issue logs (first verification/admin audit view plus download/visibility audit writes shipped; deeper analytics pending).
- [x] CP-TODO-106 `done` implement `/profile/[userId]/credentials` public profile credential display with user-controlled visibility.
- [ ] CP-TODO-107 `doing` add certificate module regression tests for issue, verify, download, revoke, public disclosure, and authorization boundaries (helper-level coverage now includes lookup filters plus certificate verification serialization/minimum-disclosure mapping; API-level boundary tests still pending).

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
- [ ] CP-TODO-019 `doing` list regression checks for login, event registration, Passport QR, verifier, certificate verification, and channel bridge flows (P0-P2 execution checklist documented; full automated flow coverage pending).
- [ ] CP-TODO-020 `todo` define launch criteria for independent Climate Passport deployment.
- [ ] CP-TODO-091 `todo` define deployment plan for `www`, `admin`, `api`, and `verify` domains.

## 12. Phase Execution Log (2026-05-23)

- [x] CP-TODO-108 `done` phase P0 unblock: fixed certificate rules Prisma select mismatch and restored successful workspace build.
- [x] CP-TODO-109 `done` phase P0 behavior fix: aligned summer-school duplicate lookup API with form UX by supporting email-or-passport-id matching.
- [x] CP-TODO-110 `done` phase P1 navigation hardening: added cross-module admin quick-link panels on events and learning-experiences admin pages.
- [x] CP-TODO-111 `done` phase P2 test scaffolding: extracted summer-school lookup filter helper and added regression tests in `tests/summer-school-lookup.test.mjs`.
- [ ] CP-TODO-112 `doing` phase P2 expansion: extend automated coverage from helper-level tests to API permission boundaries and certificate lifecycle end-to-end cases.
- [x] CP-TODO-113 `done` certificate profile visibility persistence: added `CertificateIssue.publicVisible`, owner/admin visibility API, public profile filtering, and migration `20260523001000_certificate_public_visibility`.
