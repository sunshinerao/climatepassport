# Current Architecture Decisions

Last updated: 2026-05-23

## 1. Core Platform And Channel Shell

Climate Passport is the Core Platform and system of record.

SHCW is a Channel Shell.

The Core/Shell boundary is an architecture decision, not only a branding decision. Core capabilities must be implemented once in Climate Passport and consumed by SHCW or future shells through contracts.

## 2. Current Repository State

- Root package manager: npm workspaces.
- Current primary app: `apps/passport-web`.
- Current framework: Next.js 14 App Router, React 18, TypeScript.
- Current database: PostgreSQL through Prisma.
- Current auth: custom email/password auth using bcrypt, Prisma `Session`, HTTP-only session cookie.
- Current packages:
  - `packages/passport-contracts`
  - `packages/passport-sdk`
  - `packages/passport-ui-flows`

## 3. Future Monorepo Direction

The target structure is:

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

### Target Responsibilities

`apps/passport-web`

- Public web.
- User entry.
- Passport identity and dashboard surfaces until split is complete.
- Public verification entry may start here but should move behind `verify.climatepassport.org`.

`apps/passport-admin`

- Admin and operations surfaces.
- User, event, verifier, certificate, learning experience, and audit operations.

`apps/passport-api`

- Public and internal Core API.
- Channel shell APIs.
- Verifier APIs.
- QR decode and verification endpoints.

`packages/passport-core`

- Domain services and business rules.
- Passport ID generation.
- QR payload issuing/validation.
- Verifier permission checks.
- Event registration/check-in rules.
- Certificate issuance/verification rules.

`packages/passport-contracts`

- Shared request/response contracts.
- Domain enums.
- QR payload contract types.
- Channel integration contract types.

`packages/passport-sdk`

- Client helpers for SHCW and future channels.
- Session bridge helpers.
- API client.
- Embedded flow helpers.

`packages/passport-ui`

- Shared Climate Passport UI components and flow components.
- Replaces the older `passport-ui-flows` direction over time.

## 4. Domain Ownership

### Climate Passport Core Owns

- Identity and account.
- Auth/session.
- Passport ID.
- QR.
- Verifier.
- Event registration.
- Check-in and attendance.
- Participation records.
- Person and Institution Core Master Data.
- Speaker, mentor, expert, and partner role profiles.
- Learning experience applications.
- Certificates.
- Points.
- Achievements.
- Milestones.
- Verification and audit logs.
- Event-specific access rules.

### SHCW Shell Owns

- CMS content.
- News.
- Agenda display.
- Event pages.
- Speaker presentation.
- Media center.
- Partner display.
- SHCW branding.

## 5. Verifier Decision

Verifier is not a separate app at this stage.

Verifier is integrated into Climate Passport Core, but exposed through independent APIs so that `apps/passport-web`, `apps/passport-admin`, SHCW, or future partner shells can call it without duplicating verification logic.

Core verifier responsibilities:

- verifier identity
- verifier permission
- QR decoding
- check-in validation
- attendance confirmation
- verification logs
- event-specific access rules

## 6. Web/Admin/API/Verify Split

Recommended domain model:

- `www.climatepassport.org`: public web and user entry.
- `admin.climatepassport.org`: admin entry.
- `api.climatepassport.org`: Core API entry.
- `verify.climatepassport.org`: public verification entry.

Current `apps/passport-web` may temporarily contain all surfaces. New implementation should avoid deepening this coupling and should make future extraction straightforward.

## 7. Data And Schema Direction

The current Prisma schema is a single physical schema with clear logical domains:

- User, Account, Session, VerificationToken.
- Organization.
- Track, Institution, Event, EventInstitution, EventVerifier, EventDateSlot.
- Registration, Wishlist, CheckIn, PointTransaction.
- Speaker, SpeakerRole, AgendaItem.
- InvitationRequest, SpecialPass.
- ContactMessage, NotificationPreference, Notification.
- AchievementDefinition, UserAchievement, PassportMilestone.
- CertificateCategory, CertificateTemplate, CertificateDefinition, CertificateIssue, CertificateVerification.
- ChannelSessionBridge.
- LearningExperienceCategory, Program, Stage, Application, Participation, ProgramEventLink.
- SummerSchoolApplication.

Future refactors should move business rules into `packages/passport-core` before splitting apps.

## 8. People And Institution Master Data

Speaker and Institution are long-term Core Master Data, not SHCW-only records.

Recommended model:

- `Person` as the reusable core entity.
- `Institution` as the reusable core entity.
- `SpeakerProfile`, `MentorProfile`, and `ExpertProfile` as role profiles.
- `EventSpeakerAssignment` as the event-level relationship.
- `InstitutionRole` and `PartnerRole` as project-level relationships.
- SHCW website speaker cards and agenda pages as presentation read models.

The same Person or Institution should be reusable across Climate Passport, GCA, SHCW, Learning Experience, certificates, public profiles, and future AI matching services.

Do not hard-code Speaker or Institution only inside SHCW modules.

## 9. Migration And Continuity Rules

- Preserve existing IDs and timestamps where data has already been migrated or accepted.
- Preserve user identity continuity and Passport continuity.
- Preserve check-in, attendance, points, invitation, special pass, and certificate history.
- Do not redesign mature flows only because files move.
- Do update flows when required by security, privacy, Core/Shell separation, or explicit product decisions.

## 10. Security Decisions

- Passport ID must not reveal issue year, sequence, source channel, user count, or registration order.
- Passport ID format is `XXXXXXX-XXXXXX` with no prefix and 13 random uppercase Crockford Base32 characters excluding ambiguous characters such as `I`, `L`, `O`, and `U`.
- Internal database IDs remain UUID/CUID.
- Opaque tokens are the default QR strategy.
- QR payloads must not expose personal information, raw JSON, emails, phone numbers, or internal database IDs.
- Server-side validation is always the source of truth.
- Offline QR authentication is not required at this stage.
- Channel session bridge tokens must be short-lived, one-time, hashed at rest, and constrained by target path allowlists.
- Verifier APIs must log verification attempts and enforce event-specific access rules.

## 11. Public Verification Disclosure

`verify.climatepassport.org` follows minimum necessary disclosure.

It may show verification status, certificate title, holder display name as printed on the credential, masked Passport ID, issuing organization, issue date, expiry date if applicable, credential type, related program/event, certificate number, and verification timestamp.

It must not show email, phone number, government ID, date of birth, application materials, internal user ID, admin notes, full user profile, or private Passport records.

## 12. Decisions No Longer Open

The following old open decisions are now closed:

- Verifier remains inside Core for now; it is not a standalone app yet.
- Web and Admin should split in the target architecture.
- SHCW shell must call Core through API, SDK, or embedded flow. It must not duplicate Core capabilities.
- Passport ID format is fixed as no-prefix `XXXXXXX-XXXXXX`.
- Opaque token is the default QR strategy.
- QR offline authentication is not needed for now.
- Public verification disclosure is minimum necessary.
- Speaker and Institution are Core Master Data.
