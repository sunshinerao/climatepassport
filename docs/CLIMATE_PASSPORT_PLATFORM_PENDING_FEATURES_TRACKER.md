# Climate Passport Platform Pending Features Tracker

Last updated: 2026-05-25

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
- [x] CP-TODO-069 `done` add scanner UI or embedded verifier flow. Implemented at `/[locale]/verifier` with camera (BarcodeDetector) and manual fallback.
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
- [ ] CP-TODO-114 `todo` implement shared admin shell for all `/[locale]/admin/**` routes: module-level primary menu, module-owned secondary menus, active state, and role-based visibility. Certificate Hub secondary order must be overview, records, issue, applications, categories, templates, rules, audit logs. Summer School stays a temporary Learning Experiences child and its business logic must remain untouched.

## 12. Phase Execution Log (2026-05-23)

- [x] CP-TODO-108 `done` phase P0 unblock: fixed certificate rules Prisma select mismatch and restored successful workspace build.
- [x] CP-TODO-109 `done` phase P0 behavior fix: aligned summer-school duplicate lookup API with form UX by supporting email-or-passport-id matching.
- [x] CP-TODO-110 `done` phase P1 navigation hardening: added cross-module admin quick-link panels on events and learning-experiences admin pages.
- [x] CP-TODO-111 `done` phase P2 test scaffolding: extracted summer-school lookup filter helper and added regression tests in `tests/summer-school-lookup.test.mjs`.
- [ ] CP-TODO-112 `doing` phase P2 expansion: extend automated coverage from helper-level tests to API permission boundaries and certificate lifecycle end-to-end cases.
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
