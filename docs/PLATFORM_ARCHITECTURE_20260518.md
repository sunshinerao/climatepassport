# Climate Passport Platform Architecture

Last updated: 2026-05-23

Status: Current supporting architecture baseline. For the newest decision index, start with `README.md` and `CURRENT_ARCHITECTURE_DECISIONS.md`.

## 1. Positioning

Climate Passport is the Core Platform and system of record.

Shanghai Climate Week is a Channel Shell.

This means SHCW can present branded experiences, but it does not own Core platform state for identity, account, Passport ID, QR, event registration, verifier, check-in, certificates, points, achievements, milestones, learning applications, or participation records.

## 2. Core Product Principle

Climate Passport must provide one reusable Core for:

- identity and account;
- Climate Passport ID;
- passport profile and participation record;
- event registration and attendance;
- verifier and QR validation;
- certificates and certificate verification;
- points, achievements, and milestones;
- learning experience application and completion;
- channel integration for SHCW and future partner shells.

SHCW and future shells call Core through APIs, SDK helpers, or embedded flows.

## 3. Repository Shape

Current repository shape:

```txt
apps/
  passport-web/
packages/
  passport-contracts/
  passport-sdk/
  passport-ui-flows/
prisma/
docs/
```

Target monorepo direction:

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

`packages/passport-ui-flows` is an earlier placeholder and should evolve into or be replaced by `packages/passport-ui`.

## 4. Domain Boundaries

### 4.1 Identity And Account

Owns:

- accounts;
- authentication;
- session issuance;
- password reset;
- email verification;
- role and access model;
- channel account linkage;
- channel session bridge rules.

### 4.2 Passport Identity

Owns:

- Climate Passport ID;
- passport profile;
- identity QR;
- privacy and visibility rules;
- cross-channel identity continuity.

Passport ID must be globally unique, stable, non-predictable, and non-sequential. It must not encode year, event, channel, source, user count, or registration order.

Final public format is no-prefix `XXXXXXX-XXXXXX`, using 13 random uppercase Crockford Base32 characters excluding ambiguous characters such as `I`, `L`, `O`, and `U`. Internal database IDs remain UUID/CUID.

### 4.3 Event And Participation

Owns:

- event registration;
- registration status;
- approvals and waitlists;
- attendance and check-in;
- verifier assignment;
- participation record;
- event-specific access rules.

Channel shells may display event and agenda content, but registration and participation state are Core-owned.

### 4.4 Verifier And QR

Owns:

- verifier identity;
- verifier permission;
- QR decoding;
- QR signing/encryption policy;
- check-in validation;
- attendance confirmation;
- verification logs;
- event-specific access rules.

Verifier remains inside Climate Passport Core for now, but verifier capability must be exposed through independent APIs.

Opaque tokens are the default QR strategy. The server must always validate the token and return the allowed view. Offline QR authentication is not required at this stage.

### 4.5 People And Institution Master Data

Owns:

- reusable Person records;
- reusable Institution records;
- SpeakerProfile, MentorProfile, and ExpertProfile role profiles;
- EventSpeakerAssignment relationships;
- InstitutionRole and PartnerRole relationships;
- read models consumed by SHCW speaker cards and agenda pages.

Speaker and Institution must not be hard-coded only inside SHCW modules. The same Person or Institution should be reusable across Climate Passport, GCA, SHCW, Learning Experience, certificates, public profiles, and future AI matching services.

### 4.6 Certificate Hub

Owns:

- certificate categories;
- certificate definitions and naming;
- certificate template settings and versioning;
- generation and rendering jobs;
- approval workflows;
- issuing and revocation;
- verification and authenticity lookup;
- download authorization and archive access;
- linkage to achievements, points, milestones, learning experiences, and participation records.

### 4.7 Learning Experiences

Owns:

- program categories;
- programs;
- application schema;
- applications;
- review stages;
- participation;
- completion;
- links to related events;
- completion writeback to certificates, points, achievements, and milestones.

Learning Experiences are not Events. They can link to Events.

### 4.8 Channel Delivery

Owns:

- Core APIs for shells;
- SDK helpers;
- embedded Core flows;
- channel configuration;
- session bridge;
- target path allowlists;
- channel audit and abuse controls.

## 5. Delivery Model

### 5.1 Passport Native Mode

Rendered under Climate Passport domains:

- `www.climatepassport.org`
- `admin.climatepassport.org`
- `api.climatepassport.org`
- `verify.climatepassport.org`

### 5.2 SHCW Shell Mode

Rendered under SHCW branding, but backed by Climate Passport Core.

SHCW owns CMS content, news, agenda display, event pages, speakers presentation, media center, partner display, and SHCW branding.

Core owns all account, identity, registration, verifier, QR, certificate, points, achievements, milestones, learning application, verification, and participation state.

## 6. Migration And Preservation Rules

Migration must preserve mature behavior and data where it is still compatible with the latest product decisions.

Preserve:

- user records;
- existing stable Passport IDs where already issued and still acceptable;
- pass codes or compatibility mappings;
- event records;
- registrations;
- check-in history;
- verifier assignments;
- point transactions;
- invitation and special pass records;
- certificate records;
- learning experience records;
- historical timestamps.

Do not preserve outdated assumptions such as year-based ID formats, plain URL QR payloads, or SHCW-local ownership of Core flows.

## 7. Web/Admin/API/Verify Split

Current implementation can temporarily live in `apps/passport-web`.

Future architecture should split:

- `apps/passport-web` for public web and user entry;
- `apps/passport-admin` for operations and admin;
- `apps/passport-api` for Core APIs;
- `verify.climatepassport.org` for public verification.

New work should avoid coupling that makes this extraction harder.

## 8. Closed Decisions

These are no longer open:

- Verifier currently stays in Core, not a separate app.
- Web and Admin should split in the target architecture.
- SHCW shell uses API, SDK, or embedded flows and must not duplicate Core platform capabilities.

## 9. Open Architecture Questions

- QR signing standard and key management for signed opaque event tokens.
- Final shape of `packages/passport-core`.
- First extraction boundary between `passport-web`, `passport-admin`, and `passport-api`.
- Exact public verification URL pattern under `verify.climatepassport.org`.
