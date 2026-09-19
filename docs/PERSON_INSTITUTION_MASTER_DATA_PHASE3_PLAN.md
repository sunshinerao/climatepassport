# Person / Institution Compatibility Master Data — Phase 3 Plan

Status: code complete, migration applied locally only.  
Date: 2026-09-13

## Scope

This package adds the minimum Core master-data layer needed to treat `Person` and `Institution` as long-term identity/organizational read models while preserving every existing SHCW/Event/Activity speaker and institution presentation flow.

What is included:

- Additive schema changes only: `Person`, `PersonAffiliation`, `PersonRoleProfile`; verification/role enums; a nullable `Speaker.personId` compatibility link; additive `Institution` governance/verification/alias/parent/contact fields.
- A deterministic backfill script that creates one `Person` + `SPEAKER` role profile per unlinked `Speaker`, links `Speaker.personId`, and preserves public speaker values/role strings. Defaults to `--dry-run`; zero database writes unless `--apply` is passed.
- ADMIN-only APIs for people, affiliations, role profiles, institution governance, and explicit speaker person link/unlink.
- ADMIN-only admin pages under the current shared shell for People and Institutions with search/list/detail/edit/link flows.
- Node tests covering additive schema/migration, backfill dry-run, admin-only boundaries, link/unlink, navigation scope, and absence of recruitment/matching/public-directory endpoints.

What is explicitly deferred:

- Recruitment, matching, partner search, public directory, AI, DID/VC.
- Bulk import/migration from external sources beyond the speaker backfill.
- Production migration execution; the migration is applied locally only as code-level evidence.
- Public UI surfaces that expose Person/Institution data outside the existing Speaker/Institution presentation.

## Schema additions

### New enums

- `PersonVerificationStatus`: DRAFT, PENDING, VERIFIED, REJECTED.
- `PersonAffiliationStatus`: ACTIVE, ENDED, PENDING.
- `PersonRoleType`: SPEAKER, MODERATOR, PANELIST, MENTOR, ORGANIZER, PARTNER, MEDIA, VOLUNTEER, STAFF, OTHER.
- `InstitutionVerificationStatus`: UNVERIFIED, PENDING, VERIFIED.

### New models

- `Person` — public/professional display identity. Links to at most one `User` (`userId` unique, `onDelete: SetNull`). No email/phone/auth duplication.
- `PersonAffiliation` — current/historical affiliation to an `Institution` or free-text organization name.
- `PersonRoleProfile` — typed role (e.g. SPEAKER) scoped to an institution, preserving public role titles.

### Institution additive fields

- `legalName`, `aliases` (TEXT[]), `parentInstitutionId` (self-relation), `governanceType`, `verificationStatus`, `publicContactEmail`, `publicContactPhone`, `headquartersAddress`, `foundingYear`.

### Speaker compatibility link

- `Speaker.personId` nullable foreign key to `Person`. Existing speaker records and public presentation remain unchanged.

## Migration

`prisma/migrations/20260913070000_person_institution_master_data_phase3/migration.sql`

- Additive only: `CREATE TYPE`, `CREATE TABLE`, `ALTER TABLE ... ADD COLUMN`, and foreign-key constraints.
- No `DROP`, `RENAME`, or column removals.
- Applied locally with `npm run db:sync` against the developer database as evidence, not a production deployment claim.

## Backfill

`scripts/backfill-speaker-persons.mjs`

- Default `--dry-run`.
- `--apply` runs inside a retry-wrapped Prisma interactive transaction.
- For every `Speaker` with `personId IS NULL`, creates one `Person` from public speaker fields and one `PersonRoleProfile(roleType: SPEAKER)` scoped to the speaker's existing `institutionId`.
- No fuzzy, email, name, User, Institution, or Organization matching.
- Reports opaque IDs and counts; zero writes in dry-run.

Root scripts:

- `npm run backfill:speakers:dry-run`
- `npm run backfill:speakers:apply`

## APIs

All new routes are ADMIN-only and use strict Zod schemas, bounded pagination, relationship validation, and best-effort `CoreAuditLog` writes.

| Route | Purpose |
|-------|---------|
| `GET /api/admin/people` | List/search people with pagination. |
| `POST /api/admin/people` | Create person. |
| `GET /api/admin/people/[id]` | Person detail with affiliations, role profiles, speakers. |
| `PATCH /api/admin/people/[id]` | Update person. |
| `GET /api/admin/people/[id]/affiliations` | List affiliations. |
| `POST /api/admin/people/[id]/affiliations` | Create affiliation. |
| `GET /api/admin/people/[id]/role-profiles` | List role profiles. |
| `POST /api/admin/people/[id]/role-profiles` | Create role profile. |
| `GET /api/admin/institutions` | List/search institutions with pagination. |
| `POST /api/admin/institutions` | Create institution. |
| `GET /api/admin/institutions/[id]` | Institution detail. |
| `PATCH /api/admin/institutions/[id]/governance` | Update governance/verification/contact fields. |
| `GET /api/admin/speakers` | List/search speakers. |
| `GET /api/admin/speakers/unlinked` | Speakers with `personId IS NULL`. |
| `PATCH /api/admin/speakers/[id]/person` | Link speaker to person. |
| `DELETE /api/admin/speakers/[id]/person` | Unlink speaker from person. |

## Admin UI

- Shared `AdminShell` gains a "People & Institutions" primary module with "People" and "Institutions" secondary links, ADMIN-only.
- `app/[locale]/admin/people` and `app/[locale]/admin/institutions` pages use the existing dense admin style.
- `AdminPeopleManager`: search/list/detail/edit plus affiliation and role-profile creation.
- `AdminInstitutionsManager`: search/list/detail/edit of governance fields plus a "Speaker links" tab for linking unlinked speakers to people.

## Validation runbook

1. `npm run db:format`
2. `npm run db:validate`
3. `npm run db:sync` (local only)
4. `npm run db:generate`
5. `npm run backfill:speakers:dry-run`
6. `npm test`
7. `npm run lint`
8. `npm run build`
9. `git diff --stat` review

## Deferrals

- Production migration execution is a separate deployment action.
- Recruitment, talent matching, partner marketplace, public directory, AI scoring, DID/VC, and background jobs remain out of scope.
- Advanced bulk import, CSV export, and public profile publishing controls are not implemented.
- Email/phone/person sensitive authentication data are not duplicated into Person/Institution unless genuinely public/professional (e.g. institution public contact email).
