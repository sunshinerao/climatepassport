# Current Implementation Status

Last updated: 2026-05-23

## 1. Implemented

### Repository And App Foundation

- npm workspace root with `apps/*` and `packages/*`.
- `apps/passport-web` Next.js 14 App Router app.
- Shared TypeScript baseline.
- Current placeholder packages for contracts, SDK, and UI flows.
- `packages/passport-core` now contains first shared Core rules for Passport ID, opaque token helpers, QR token hashing, certificate verification codes, and channel bridge target path validation.
- `packages/passport-sdk` now contains a first client skeleton for bridge issue/exchange helpers and public certificate verification.

### Database And Data Layer

- Prisma schema with PostgreSQL datasource.
- Migration baseline exists under `prisma/migrations/20260522000000_baseline`.
- QR/verifier/audit migration exists under `prisma/migrations/20260523000000_qr_verifier_audit`.
- Seed script exists at `prisma/seed.mjs`.
- Server Prisma loader exists in `apps/passport-web/lib/server/prisma.ts`.

### Auth And Session

- Email normalization.
- bcrypt password hashing.
- Login/register/logout/session APIs.
- HTTP-only session cookie.
- Prisma session lookup.
- Role-based route guard helpers.

### Current Routes And Pages

- Public web routes: home, about, events, speakers, certificates, contact, FAQ, privacy, terms.
- Locale routes under `[locale]`.
- Auth routes: login and register.
- Dashboard routes: overview, Climate Passport, learning experiences, messages, notifications, summer school.
- Admin routes: events, learning experiences, learning applications, certificates, summer school applications.
- Summer school application route.
- Certificate routes now include user list/detail and public verification page shells: `/[locale]/dashboard/certificates`, `/[locale]/dashboard/certificates/[id]`, `/verify/certificate/[code]`.

### Current APIs

- Auth APIs.
- Dashboard notifications and contact message APIs.
- Admin events APIs.
- Admin certificates issue API.
- Learning experience public/admin APIs.
- Summer school application APIs.
- Channel session bridge issue/exchange APIs.

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

### Learning Experiences

- Domain modeled separately from Event.
- Program, application, stage, participation, and event link models exist.
- User draft/save/submit APIs exist.
- Admin status transition APIs exist.
- Participation sync exists in first form.

### Certificate Hub

- Prisma models exist for category, template, definition, issue, verification.
- `CERTIFICATE_MODULE_PRODUCT_REQUIREMENTS.md` is now the current Certificate module PRD and development plan.
- Admin certificate issue API exists.
- Admin certificate issue API exists and uses opaque verification codes.
- Public certificate verification API exists.
- Authenticated certificate download authorization and download count tracking API exists.
- Admin certificate revocation API exists.
- User certificate list/detail UI and public verify UI are now runnable in first version.
- User certificate list has search, category filter, and status filter.
- Certificate detail public profile visibility toggle is persisted through `CertificateIssue.publicVisible`.
- Public profile credentials route only displays issued certificates explicitly marked public.
- Certificate download and visibility changes write Core audit logs.
- Admin records/issue/templates/categories/applications/rules/audit pages now have first route/page shells in place.
- Full external file storage, rule automation depth, admin action completeness, richer public profile publishing controls, and productized audit analytics remain pending.

### Phase Execution (P0-P2, 2026-05-23)

- P0: fixed certificate rules page Prisma select mismatch that blocked `npm run build`.
- P0: aligned summer-school duplicate lookup behavior with form UX (email OR passport ID match).
- P1: added cross-module admin quick-link panels on events and learning-experiences admin pages to improve discoverability.
- P2: extracted summer-school lookup filter helper and added regression tests in `tests/summer-school-lookup.test.mjs`.

### Channel Session Bridge

- One-time token issue API exists.
- One-time token exchange API exists.
- Token hashes are persisted.
- Expiry and consumed timestamp exist.
- Bridge target paths are allowlisted.
- Issue/exchange APIs have basic in-memory rate limiting.

### QR And Verifier

- Opaque QR token model exists.
- Identity QR issue API exists.
- Event check-in QR issue API exists.
- Verifier scan API exists for identity validation and event check-in.
- Verifier scan writes Core audit logs and enforces event-specific verifier access.

## 2. In Progress / Partial

- QR Code issuing and verifier APIs now exist as a minimum server-side closed loop; signed/encrypted token wrappers, rotation policy, and scanner UI remain partial.
- Verifier is implemented as an API capability; scanner UI still needs implementation.
- Admin and Web are currently in one app and need target split planning.
- Certificate Hub has issue, verify, download count, and revoke APIs; rendering/storage and admin/user UI still need completion.
- Learning Experience completion now writes back participation completion, certificate issue when configured, points, point ledger, and milestones. Cohort operations and deeper reviewer workflow remain partial.
- Channel bridge still needs replay monitoring and production-grade distributed rate limits.
- Points and milestones writeback exist for Learning Experience completion; broader achievement rules and productized UI remain partial.
- Certificate user/admin surfaces are now available in first phase, but operational depth (filters, batch workflows, persistence toggles, richer actions) remains partial.

## 3. Pending

- Invitation / Special Pass QR implementation.
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
- Full API/E2E regression tests for auth, event registration, QR, verifier, certificate lifecycle, and channel bridge.

## 4. Deprecated / Superseded

- Year-based or sequential Passport IDs.
- Channel-prefixed Passport IDs such as SHCW-specific IDs.
- Plain URL QR as the trusted payload.
- QR payloads containing personal data in cleartext.
- SHCW-local ownership of Core identity, registration, verifier, certificate, points, achievements, milestones, QR, or participation records.
- Treating verifier split as an open near-term app decision.
- Treating Web/Admin split as undecided target architecture.

## 5. Current Development Priorities

1. Add scanner UI or embedded verifier flow.
2. Implement Certificate module Phase 1 from `CERTIFICATE_MODULE_PRODUCT_REQUIREMENTS.md`: user list/detail, public verify UI, admin records, admin issue UI, and template management skeleton.
3. Add invitation / special pass QR support.
4. Add production-grade replay monitoring and distributed rate limits.
5. Define remaining achievement writeback rules.
6. Plan `passport-admin` and `passport-api` extraction.
7. Continue moving shared business rules into `packages/passport-core`.
8. Add broader regression tests for authenticated Core flows.
