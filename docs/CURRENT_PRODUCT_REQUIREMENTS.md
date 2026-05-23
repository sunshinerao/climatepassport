# Current Product Requirements

Last updated: 2026-05-23

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

### Climate Passport ID

- Every user must have one globally unique, stable, non-predictable Climate Passport ID.
- The ID must not include a year, channel prefix, sequence number, registration order, user count, or source channel.
- The public format is `XXXXXXX-XXXXXX`, with no prefix and 13 random uppercase Crockford Base32 characters excluding ambiguous characters such as `I`, `L`, `O`, and `U`.
- Internal database IDs remain UUID/CUID and must not be exposed as Passport ID.
- The ID must support cross-event, cross-institution, cross-country, and cross-shell recognition of the same Climate Passport identity.
- Detailed rules live in `PASSPORT_ID_AND_QR_SPEC.md`.

### QR And Verification

- QR Code must not be a plain URL.
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

- Core owns event registration, registration status, attendance, check-in, participation record, verifier assignment, and points linkage.
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
- Learning Experiences own application, review, admission, participation, completion, and outcome records.
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

### Channel Shell Integration

- SHCW and future partner channels use Core APIs, SDKs, or embedded flows.
- Channel shells must not duplicate account, QR, verifier, registration, certificate, points, achievement, milestone, or participation logic.
- Detailed rules live in `CHANNEL_SHELL_INTEGRATION_SPEC.md`.

## 5. Public Product Surfaces

Recommended future domain split:

- `www.climatepassport.org`: public web and user entry.
- `admin.climatepassport.org`: admin and operations entry.
- `api.climatepassport.org`: Core API entry.
- `verify.climatepassport.org`: public verification entry.

The public verification page should verify the credential, not expose the person. It may show verification status, certificate title, holder display name as printed, masked Passport ID, issuing organization, issue date, expiry date if applicable, credential type, related program/event, certificate number, and verification timestamp. It must not show email, phone, government ID, date of birth, application materials, internal user ID, admin notes, full user profile, or private Passport records.

## 6. MVP Priorities

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

## 7. Non-Goals

- Climate Passport is not a normal event website.
- Climate Passport is not a generic CMS.
- Climate Passport is not only an LMS.
- Climate Passport is not only a certificate tool.
- SHCW must not become a second implementation of Climate Passport Core.
