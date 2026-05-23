# Climate Passport Development Specification

Last updated: 2026-05-23

Status: Current supporting product specification. The source-of-truth entrypoint is `docs/README.md`.

## 1. Product Definition

Climate Passport is a trusted climate identity and participation infrastructure. It converts learning, certificates, events, projects, actions, capabilities, and international collaboration into verifiable, accumulative, displayable, and usable digital records.

Climate Passport is not a normal environmental website, not only an LMS, not only an event registration system, and not only a certificate tool.

## 2. Platform Direction

Climate Passport is the Core Platform.

SHCW is a Channel Shell.

Climate Passport Core owns identity, account, login/register, Climate Passport ID, event registration, learning experience application, certificate, points, achievements, milestones, QR, verifier, check-in, verification, and participation records.

SHCW owns CMS content, news, agenda display, event pages, speakers presentation, media center, partner display, and SHCW branding.

## 3. Target Users

### Individual Users

- Create and maintain a Climate Passport identity.
- Register for events.
- Apply for learning experiences.
- Receive certificates.
- Accumulate points, achievements, and milestones.
- Present verified participation records.

### Institutions And Program Operators

- Publish or manage Core-owned programs and events where authorized.
- Review applications.
- Issue or request certificates under Core rules.
- Read participation and verification records.

### Admins And Operators

- Manage users, roles, events, verifiers, certificates, learning experiences, and platform records.
- Review and audit high-impact operations.

### Channel Shells

- Present branded content.
- Invoke Core-owned flows.
- Avoid duplicating Core business logic.

## 4. Core Modules

### 4.1 Identity And Account

Required capabilities:

- registration;
- login;
- logout;
- email normalization;
- password hashing;
- session issuance;
- role and status management;
- profile basics;
- channel session bridge.

### 4.2 Climate Passport ID

Every user must have one globally unique, stable, non-predictable Climate Passport ID.

The ID must not:

- include a year;
- include a source channel;
- include an event prefix;
- use a simple sequence number;
- reveal registration order;
- reveal user count;
- expose personal data.

Rejected examples:

```txt
CP-2026-000001
CP-000001
SHCW-2026-001
```

The final algorithm is defined separately in `PASSPORT_ID_AND_QR_SPEC.md`.

Current final format:

```txt
XXXXXXX-XXXXXX
```

It has no prefix and uses 13 random uppercase Crockford Base32 characters excluding ambiguous characters such as `I`, `L`, `O`, and `U`. Internal database IDs remain UUID/CUID.

### 4.3 Climate Passport Profile

The Passport profile is the user-facing long-term identity and record surface.

It should include:

- Passport ID;
- identity status;
- profile basics;
- participation records;
- certificates;
- points;
- achievements;
- milestones;
- learning experience records;
- privacy controls.

### 4.4 QR Code And Verification

QR Code must not be a plain URL and must not contain name, email, phone, document number, or other personal information in cleartext.

Opaque tokens are the default QR strategy. QR payloads must be generated, decoded, and verified by Climate Passport Core. Event check-in tokens may also be signed for tamper resistance.

Required QR types:

- Identity QR;
- Event Check-in QR;
- Certificate Verification QR;
- Invitation / Special Pass QR.

Detailed rules are in `PASSPORT_ID_AND_QR_SPEC.md`.

Offline QR authentication is not required at this stage.

### 4.5 People And Institution Master Data

Person and Institution are Core Master Data.

Recommended model:

- Person as core entity;
- Institution as core entity;
- SpeakerProfile, MentorProfile, and ExpertProfile as role profiles;
- EventSpeakerAssignment as event-level relationship;
- InstitutionRole and PartnerRole as project-level relationship;
- SHCW website speaker cards and agenda pages as presentation read models.

Do not hard-code Speaker or Institution only inside SHCW modules.

### 4.6 Verifier

Verifier remains integrated into Climate Passport Core for the current stage.

Verifier APIs must be independently callable by `passport-web`, SHCW shell, or future partner shells.

Core owns verifier identity, verifier permission, QR decoding, check-in validation, attendance confirmation, verification logs, and event-specific access rules.

### 4.7 Events And Participation

Core owns:

- event registration;
- approval and waitlist status;
- attendance;
- check-in;
- verifier assignment;
- participation record;
- points and certificate triggers.

SHCW may display event pages and agenda, but must call Core for registration and participation state.

### 4.8 Learning Experiences

Learning Experiences are an independent Program/Application domain.

They must not be collapsed into Event.

Core objects:

- LearningExperienceCategory;
- LearningExperienceProgram;
- LearningExperienceStage;
- LearningExperienceApplication;
- LearningExperienceParticipation;
- ProgramEventLink.

Learning completion may write certificates, points, achievements, and milestones into the user's Climate Passport.

### 4.9 Certificate Hub

Certificate Hub must cover:

- category;
- definition;
- template;
- render config;
- issue;
- approval;
- generation;
- revocation;
- verification;
- download;
- audit history.

Certificates must link to a Passport identity and may link to learning experiences, event participation, points, achievements, and milestones.

### 4.10 Points, Achievements, Milestones

Core owns points ledger, achievement definitions, user achievements, and Passport milestones.

Records must be auditable and traceable to their source.

## 5. Architecture Requirements

Recommended future domains:

- `www.climatepassport.org`: public web and user entry.
- `admin.climatepassport.org`: admin and operations.
- `api.climatepassport.org`: Core APIs.
- `verify.climatepassport.org`: public verification.

Recommended monorepo direction:

```txt
apps/
  passport-web/
  passport-admin/
  passport-api/
packages/
  passport-core/
  passport-contracts/
  passport-sdk/
  passport-ui/
```

## 6. Current Technical Baseline

Current repository implementation:

- npm workspaces.
- Next.js 14 App Router in `apps/passport-web`.
- React 18 and TypeScript.
- Prisma 5 and PostgreSQL.
- Custom auth with bcrypt and Prisma sessions.
- HTTP-only session cookie.
- Prisma schema at `prisma/schema.prisma`.

Current database models already cover identity, events, speakers, agenda, registration, check-in, points, invitation, special pass, certificates, channel bridge, notifications, learning experiences, and summer school application records.

## 7. UI And Design Direction

Use the Climate Passport institutional design system in `climate-passport-design-foundation.md`.

The UI should feel:

- institutional;
- global;
- calm;
- trustworthy;
- multilingual;
- restrained;
- operationally clear.

Avoid:

- cartoon environmental visuals;
- bright NGO-style green;
- decorative eco cliches;
- excessive Web3 styling;
- noisy gradients;
- playful dashboard patterns where operational clarity is needed.

## 8. MVP Development Priority

1. Implement final no-prefix `XXXXXXX-XXXXXX` Passport ID generation.
2. Opaque QR token issuing and verification.
3. Verifier API and scanner flow.
4. Event check-in validation and attendance confirmation.
5. Certificate verification and public verify route.
6. Certificate issue/download/revocation lifecycle.
7. Learning Experience cohort operations and completion writeback.
8. Points, achievements, and milestones rules.
9. Channel shell SDK and embedded flow contract.
10. Admin/Web/API split plan.

## 9. Development Guardrails

- Do not implement Core logic twice in SHCW.
- Do not use year-based or sequential Passport IDs.
- Do not put personal data in QR payload cleartext.
- Do not let channel shells decode or trust QR payloads locally.
- Do not expose more than minimum necessary fields on public certificate verification pages.
- Do not add business-code behavior from archived docs unless current authority docs confirm it.
- Keep business rules portable so they can move into `packages/passport-core`.
- Keep contracts explicit so channel shells can integrate safely.

## 10. Current Source Of Truth

For future development, read:

1. `README.md`
2. `CURRENT_PRODUCT_REQUIREMENTS.md`
3. `CURRENT_ARCHITECTURE_DECISIONS.md`
4. `PASSPORT_ID_AND_QR_SPEC.md`
5. `CHANNEL_SHELL_INTEGRATION_SPEC.md`
6. `CURRENT_IMPLEMENTATION_STATUS.md`
7. `CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md`
