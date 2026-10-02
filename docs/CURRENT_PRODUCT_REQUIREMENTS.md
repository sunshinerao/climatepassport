# Current Product Requirements

Governing authority: [Climate Passport 最高开发指导纲领](CP_MASTER_DEVELOPMENT_DIRECTIVE.md). This document provides subordinate product detail; the master directive prevails in any conflict.

Last updated: 2026-10-02 (master directive and independent-partner scope incorporated)

## Execution And Acceptance Addendum (2026-09-18)

Use [the current gap audit](REQUIREMENTS_IMPLEMENTATION_GAP_AUDIT_20260918.md) for implementation evidence and [the development requirements and plan](DEVELOPMENT_REQUIREMENTS_AND_PLAN_20260918.md) for remaining delivery and acceptance requirements. Existing modules must be completed rather than recreated. Summer-school flows remain frozen; changes to shared dependencies require compatibility regression without expanding summer-school scope.

All resource routes, including legacy, export and batch endpoints, must enforce scoped authorization and authoritative state transitions. Certificate delivery requires real PDF generation, immutable issuance data, unique opaque verification codes, minimum public disclosure, Unicode download filenames and reliable lifecycle audit; printable HTML alone does not fulfill the final PDF requirement. Public portfolio access uses consent-based revocable tokens, never enumerable account IDs. Mock regression success and local migrations are not full browser or production acceptance.

The current documented menu order is preserved pending reconciliation with the earlier user-specified ordering; this is not authorization to reorder navigation. Domain examples are architectural targets, not deployed endpoints: production host/callback/cookie/allowlist settings require a verified configuration inventory.
## 1. Product Definition

Climate Passport is the shared digital foundation for trusted identity, scoped programme participation and collaboration, versioned evidence, authorized publication, certificates, points, achievements, milestones, verification, and long-term cross-channel records.

The current functional baseline is [V2 with the V2.1 boundary correction](CLIMATE_PASSPORT_FUNCTIONAL_REQUIREMENTS_V2.md), derived from [three programme inputs](PROGRAMME_REQUIREMENTS_SYNTHESIS_20260918.md). CP develops only reusable digital infrastructure and integration contracts. Each programme independently develops and maintains its business layer and user/operator experience outside CP: FS learning/editorial systems, SHCW annual operations, and Convener membership/activation/support/assessment systems. Business authority alone is not sufficient separation; these implementations are explicitly excluded from CP development.

Climate Passport must be usable across events, institutions, countries, and future partner shells without exposing registration order, channel source, or personal data.

## 2. Current Product Boundary

### Climate Passport Core Owns

- identity
- account
- login/register
- Climate Passport ID
- event registration
- learning experience application
- certificate
- points
- internal redemption reservation accounting only: journal `USER_AVAILABLE` is representational while available points remain legacy `User.points` minus outstanding reservations until ledger cutover (no redemption product or fulfillment)
- achievements
- milestones
- QR
- verifier
- check-in
- verification
- explainable verified portfolio and owner-controlled token sharing (private by default; no public identifier lookup)
- participation record
- scoped access grants (not business membership or seats), institution representation and consent enforcement as shared services
- generic private record/asset versions, object-level sharing, validated external decision receipts and audit
- authorized publication state/read gates and revocation, distinct from programme editorial judgment

### SHCW Shell Owns

- CMS content
- news
- agenda display
- event pages
- speakers presentation
- media center
- partner display
- SHCW branding
- private annual event-host submissions, Speaker/Venue/Volunteer applications, reviews, revisions/rejections, candidate invitations/negotiations and venue/volunteer preparation
- authoritative approved programme content and publication revisions, shared with Core via source mappings rather than a second editable activity record

SHCW must call Climate Passport Core through API, SDK, or embedded flows for Core capabilities.

Application ownership is purpose-specific: SHCW hosting/operational applications are not CP participant registrations, Learning Experience applications or certificate requests. Programmes own their business code, state machines and data models and integrate through scoped APIs/SDK/events; no programme-specific module, table or workflow is added to CP merely by calling it hosted configuration. Generic CP asset storage does not transfer business ownership. Private drafts, rejection reasons and commercial negotiations never become public action history.

### Multi-Programme Requirements

CP-FR-050 through 073 distinguish shared capabilities from external requirements. CP builds scope/delegation, formal source activity mapping, generic participation, private records/assets/versioning, external decision validation, consent/revocation, contributions, notifications/data lifecycle and reliable contracts. CP-FR-063/064/065 are external business requirements, not CP deliverables: no Credit/Standing engine, seats/annual activation, Offer-Need or support-ticket system. FS Inquiry/seven-step learning/editorial workspaces likewise remain external. Intake of approved results is not implementation of the business that produced them.

Programme roles do not confer cross-programme access. Employment is not representation; login is not identity verification, admission or certification; payment is not activation or Credit. A technical platform administrator has no default authority to read all new private workspaces or make business approvals. Break-glass support must be approved, time-limited and audited.

Private/Public author intent, version review, publication state and channel/use consent must remain independent. FS publication is not permission for CP promotion, sponsor access or AI training. Credit/Standing are scoped programme assessments, not User.points or a global reputation score. Operating quantities, response SLAs, age/retention rules and weights from discussion drafts require approval before enablement.

Passport IDs retain the current no-prefix `XXXXXXX-XXXXXX` specification; the conflicting CP-plus-12-character suggestion in the Convener input is not adopted. Summer school remains frozen. Security gates are shared, but a programme not enabling certificates need not wait for the entire certificate roadmap; any enabled PDF download still requires real PDF acceptance.

Independent third-party systems are not necessarily channel shells. They retain their UI, business data, passwords, and approval workflows; CP receives authorized confirmed facts and provides scoped Core capabilities without requiring partner business operations to redirect into CP. The Core-owned registration/application lifecycle below applies to CP-native projects and thin shells, not to every partner's internal workflow.

Every CP module must plan authorized Open API access for its relevant capabilities and records. Integration is more than write-only ingestion; CP check-in, credential decisions, wallets, authorized reads, and correction/revocation remain controlled services. Detailed requirements live in [Partner Identity And Trust Requirements](PARTNER_IDENTITY_AND_TRUST_REQUIREMENTS.md).

## 3. Core User Roles

- Individual user: owns a Climate Passport identity, applies for learning experiences, registers for events, receives certificates, earns points, and builds a long-term record.
- Admin: manages authorized Core operations; programme business approval and private-content access require explicit scoped grants, not a blanket technical-admin exemption in new modules.
- Event manager: manages assigned events, registrations, attendance, and related event operations, including the permitted Activity Center operational routes and scanner navigation.
- Verifier: scans and validates QR payloads, performs check-in or verification actions, and creates audit logs through the `/{locale}/verifier` console; Verifiers do not enter `/{locale}/admin/**`.
- Channel shell: presents branded content and invokes Core flows without owning Core business state.
- Partner institution: future issuer, organizer, verifier, or channel integrator.

## 4. Required Core Modules

### Identity And Account

- Email/password registration and login.
- Session issuance and logout.
- Role and status model.
- User profile and Climate Passport identity.
- Channel bridge support for trusted shell handoff.
- Independent partners retain their own passwords; CP never receives or synchronizes partner passwords or hashes.
- Explicit optional consent to also register with CP creates a private, unclaimed Passport for a new identity, not an authenticated account or public profile. Verify ownership before first CP password setup or linkage to an existing account. Existing CP credentials are never overwritten by partner provisioning.
- First access must offer activation/password setup; ordinary password reset may share secure primitives but must not bypass claim, account-state, or MFA checks. Email equality alone is not authorization to merge identities.

### Climate Passport ID

- Every user must have one globally unique, stable, non-predictable Climate Passport ID.
- The ID must not include a year, channel prefix, sequence number, registration order, user count, or source channel.
- The public format is `XXXXXXX-XXXXXX`, with no prefix and 13 random uppercase Crockford Base32 characters excluding ambiguous characters such as `I`, `L`, `O`, and `U`.
- Internal database IDs remain UUID/CUID and must not be exposed as Passport ID.
- The ID must support cross-event, cross-institution, cross-country, and cross-shell recognition of the same Climate Passport identity.
- Detailed rules live in `PASSPORT_ID_AND_QR_SPEC.md`.

### QR And Verification

- A plain URL or identifier must not be treated as a trusted QR credential. An HTTPS verification URL may carry an opaque token/code; trust comes from server-side validation, not from URL structure. See `PASSPORT_ID_AND_QR_SPEC.md`.
- Public profile URLs and verification URLs are allowed only under the opaque-token, privacy, and server-side validation rules in `PASSPORT_ID_AND_QR_SPEC.md`.
- QR Code must not expose name, email, phone, or other personal data in cleartext.
- Opaque tokens are the default QR strategy.
- QR codes must not contain raw JSON payloads, internal database IDs, emails, phone numbers, or personal data.
- Server-side validation is always required.
- Offline QR authentication is not required at this stage.
- Required QR types:
  - Identity QR
  - Event Check-in QR
  - Certificate Verification QR
  - Invitation / Special Pass QR
- Detailed rules live in `PASSPORT_ID_AND_QR_SPEC.md`.

### Verifier

- Verifier currently stays inside Climate Passport Core.
- Verifier capability must be exposed through independent APIs for SHCW shell and future partner shells.
- Core owns verifier identity, verifier permission, QR decoding, check-in validation, attendance confirmation, verification logs, and event-specific access rules.

### Event And Participation

- For CP-native projects and thin shells, Core owns event registration, registration status, attendance, check-in, participation record, verifier assignment, and points linkage. Independent partners own their approval process and submit confirmed participation facts, including subsequent corrections or cancellations.
- Channel shells may display agenda and event pages, but must call Core for registration and participation actions.

### People And Institutions

- Person and Institution are Core Master Data in the long-term architecture.
- SpeakerProfile, MentorProfile, and ExpertProfile are role profiles attached to a reusable Person.
- EventSpeakerAssignment is the event-level relationship between Person and Event.
- InstitutionRole and PartnerRole are project-level relationships.
- SHCW speaker cards and agenda pages are presentation read models that consume Core data.
- Do not hard-code Speaker or Institution only inside SHCW modules.
- The same Person or Institution should be reusable across Climate Passport, GCA, SHCW, Learning Experience, certificates, public profiles, and future AI matching services.

### Learning Experiences

- Learning Experiences must remain an independent Program/Application domain.
- Learning Experiences must not be collapsed into Event.
- Events can be linked to a program for orientation, demo day, graduation, ceremony, or public session.
- CP-native Learning Experiences own application, review, admission, participation, completion, and outcome records. External learning providers retain their internal workflows and submit authorized confirmed outcomes/evidence.
- Completion can write certificates, points, milestones, and achievements back into Climate Passport.

### Certificate Hub

- Certificate Hub is a Core module, not a presentation layer.
- It must cover certificate category, definition, template, rendering configuration, issue, approval, generation, revocation, verification, download, and audit history.
- Certificates must link to Passport identity and may link to achievements, points, milestones, learning experiences, and event participation.
- Detailed certificate product requirements, pages, workflows, admin operations, and phased development plan live in `CERTIFICATE_MODULE_PRODUCT_REQUIREMENTS.md`.

### Points, Achievements, Milestones

- Core owns the points ledger and user-visible summaries.
- Achievements and milestones are long-term Passport records.
- Certificates, learning completion, attendance, and other verified actions may write to these records according to Core rules.
- Institution trust and activity trust must be assessed separately; individual evidence and authorized issuer status are additional reward gates. Higher institution trust does not automatically qualify every activity or participant for rewards.
- Versioned policies map eligible verified facts to certificate categories, points, badges, and other rewards. Preserve source evidence and decision snapshots; support caps, review, correction, revocation, and compensating point entries. Final tier names and numerical mappings remain to be approved.
- User-facing source/reward explanations, admin trust registers and policy management, and scoped partner APIs are required. See [Partner Identity And Trust Requirements](PARTNER_IDENTITY_AND_TRUST_REQUIREMENTS.md).

### Channel Shell Integration

- SHCW and future partner channels use Core APIs, SDKs, or embedded flows.
- Channel shells must not duplicate account, QR, verifier, registration, certificate, points, achievement, milestone, or participation logic.
- Detailed rules live in `CHANNEL_SHELL_INTEGRATION_SPEC.md`.

## 5. Admin Information Architecture

Admin pages must use a shared operations shell: the left side is the admin navigation, and the right side is the concrete feature page. The current `/[locale]/admin` sidebar pattern is the reference layout for all `/[locale]/admin/**` routes.

The global admin menu is module-level. It must not flatten every module's internal pages into the top-level navigation.

### 5.1 Global Admin Primary Menu

Required primary menu items:

1. Dashboard overview: `/{locale}/admin`
2. Event management: `/{locale}/admin/events`
3. Learning Experiences: `/{locale}/admin/learning-experiences`
4. Certificate Hub: `/{locale}/admin/certificates`
5. System and operations: reserved for future user management, notifications, site settings, and platform-level operations.
6. Return to user workspace: `/{locale}/dashboard`

### 5.2 Learning Experiences Secondary Menu

Learning Experiences owns its internal secondary menu:

1. Program overview / program management: `/{locale}/admin/learning-experiences`
2. Application management: `/{locale}/admin/learning-experiences/applications`
3. Summer School applications, temporary function: `/{locale}/admin/summer-school/applications`

Summer School remains a temporary function under Learning Experiences. Its existing business state and page behavior should not be changed unless explicitly requested.

### 5.3 Certificate Hub Secondary Menu

Certificate Hub owns its internal secondary menu. The global admin menu should show Certificate Hub as one module, then expand these module-owned items in this order:

1. Certificate overview: `/{locale}/admin/certificates`
2. Certificate records: `/{locale}/admin/certificates/records`
3. Issue certificates: `/{locale}/admin/certificates/issue`
4. Application review: `/{locale}/admin/certificates/applications`
5. Category management: `/{locale}/admin/certificates/categories`
6. Template management: `/{locale}/admin/certificates/templates`
7. Automatic issuing rules: `/{locale}/admin/certificates/rules`
8. Verification and audit logs: `/{locale}/admin/certificates/audit-logs`

### 5.4 Role-Based Menu Visibility

- `ADMIN` sees all implemented admin modules and Certificate Hub secondary items.
- `EVENT_MANAGER` sees dashboard overview, Event management, Learning Experiences, permitted Activity Center routes (activity lists/creation, applications, participation, check-in/scanner, tasks, submissions, and reviews), the verifier console, and return to user workspace. Reward rules, certificate rules, form templates, and global organizer management remain `ADMIN` only.
- Certificate Hub is currently `ADMIN` only.
- Achievement and badge moderation is `ADMIN` only.
- Summer School temporary entry is currently `ADMIN` only and appears under Learning Experiences.

### 5.5 Layout And Active-State Requirements

- All `/zh/admin/**` and `/en/admin/**` pages use the same shared admin shell supplied by `app/[locale]/admin/layout.tsx`; pages must not add nested shells.
- The active primary menu item must be highlighted.
- If the current path belongs to a module, that module's secondary menu must expand and highlight the active secondary item.
- Existing non-locale `/admin/**` redirects should continue to redirect to `/en/admin/**`.

## 6. Public Product Surfaces

Recommended future domain split:

- `www.climatepassport.org`: public web and user entry.
- `admin.climatepassport.org`: admin and operations entry.
- `api.climatepassport.org`: Core API entry.
- `verify.climatepassport.org`: public verification entry.

The public verification page should verify the credential, not expose the person. It may show verification status, certificate title, holder display name as printed, masked Passport ID, issuing organization, issue date, expiry date if applicable, credential type, related program/event, certificate number, and verification timestamp. It must not show email, phone, government ID, date of birth, application materials, internal user ID, admin notes, full user profile, or private Passport records.

## 7. MVP Priorities

1. Stable Passport ID and QR specification.
2. Core/Shell integration contract for SHCW.
3. Verifier API design and implementation.
4. Passport Web user identity, dashboard, and profile completion.
5. Admin split direction and admin route hardening.
6. Event registration and check-in flow completion.
7. Certificate Hub issue and verification lifecycle.
8. Learning Experience application and review lifecycle.
9. Points, achievements, and milestones writeback rules.
10. Audit logs, regression checks, and launch criteria.

The next partner-integration work must include consent-based provisioning/claim, institution and activity trust assessment, and versioned reward eligibility. See the dated priority block in `CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md`; documentation approval does not mean those capabilities are implemented.

## 7.1 Long-Term Requirement Outside The Current Plan

Blockchain anchoring remains a long-term requirement from the platform functional requirements PDF, but is not included in the current development plan or release prerequisites. Do not schedule chain selection, smart contracts, blockchain wallets, or anchoring jobs now, and do not display blockchain-verification claims without a delivered mechanism. This does not change the off-chain points wallet, opaque QR, online server validation, or current credential verification requirements.

## 8. Non-Goals

- Climate Passport is not a normal event website.
- Climate Passport is not a generic CMS.
- Climate Passport is not only an LMS.
- Climate Passport is not only a certificate tool.
- SHCW must not become a second implementation of Climate Passport Core.
# Controlled PROJECT application update (2026-09-13)

`Activity.type = PROJECT` has a controlled local-only application workflow. Applicants explicitly choose field-level disclosure under `PROJECT_APPLICATION_CONSENT_V1`; owner/admin reviewers see only consented fields and never raw portfolio tokens, Passport IDs, or applicant identifiers. ADMIN is global; only the exact `organizerUserId` otherwise reviews; EVENT_MANAGER is denied by default. PROJECT supports APPROVED, REJECTED, and WAITLISTED only. The additive migration is local-only. No interest-only behavior, team applications, jobs, recruitment/candidate or institution search, matching, AI, or public applicant directory is in scope. See `PROJECT_INTEREST_APPLICATION_PRIVACY_OPERATIONS.md`.

## Approved cross-site governance (2026-10-01)

The user-approved [CP business rules register](CP_BUSINESS_RULES.md) is the canonical ongoing authority for registration, frozen rule versions, source facts, purpose separation and reward compensation. app-outcome/1 APPLIED remains private archive acceptance, never an automatic reward or certificate. New scoped business approval does not derive from technical ADMIN role. Detailed acceptance and supported paths remain separately recorded; no production activation is implied.
