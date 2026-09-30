# Current Product Requirements

Governing authority: [Climate Passport 最高开发指导纲领](CP_MASTER_DEVELOPMENT_DIRECTIVE.md). This document provides subordinate detail; the master directive prevails in any conflict.

Last updated: 2026-09-22 (partner identity, trust-based rewards, and deferred blockchain scope)

## 1. Product Definition

Climate Passport is the Core Platform for trusted climate identity, participation, learning, certificates, points, achievements, milestones, verification, and cross-channel records.

SHCW is a Channel Shell for Shanghai Climate Week branded content and presentation.

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
- achievements
- milestones
- QR
- verifier
- check-in
- verification
- participation record

### SHCW Shell Owns

- CMS content
- news
- agenda display
- event pages
- speakers presentation
- media center
- partner display
- SHCW branding

SHCW must call Climate Passport Core through API, SDK, or embedded flows for Core capabilities.

Independent third-party systems are not necessarily channel shells. They retain their UI, business data, passwords, and approval workflows; CP receives authorized confirmed facts and provides scoped Core capabilities without requiring partner business operations to redirect into CP. The Core-owned registration/application lifecycle below applies to CP-native projects and thin shells, not to every partner's internal workflow.

Every CP module must plan authorized Open API access for its relevant capabilities and records. Integration is more than write-only ingestion; CP check-in, credential decisions, wallets, authorized reads, and correction/revocation remain controlled services. Detailed requirements live in [Partner Identity And Trust Requirements](PARTNER_IDENTITY_AND_TRUST_REQUIREMENTS.md).

## 3. Core User Roles

- Individual user: owns a Climate Passport identity, applies for learning experiences, registers for events, receives certificates, earns points, and builds a long-term record.
- Admin: manages Core platform records, users, events, certificates, learning experiences, verifiers, and operational rules.
- Event manager: manages assigned events, registrations, attendance, and related event operations.
- Verifier: scans and validates QR payloads, performs check-in or verification actions, and creates audit logs.
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

- A plain URL must not be treated as trusted QR proof. Public profile URLs and verification URLs are allowed under the opaque-token, privacy, and server-validation rules in `PASSPORT_ID_AND_QR_SPEC.md`.
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
- `EVENT_MANAGER` sees dashboard overview, Event management, Learning Experiences, and return to user workspace.
- Certificate Hub is currently `ADMIN` only.
- Summer School temporary entry is currently `ADMIN` only and appears under Learning Experiences.

### 5.5 Layout And Active-State Requirements

- All `/zh/admin/**` and `/en/admin/**` pages must use the same shared admin shell.
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
