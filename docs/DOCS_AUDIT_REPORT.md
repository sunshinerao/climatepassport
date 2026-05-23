# Climate Passport Docs Audit Report

Date: 2026-05-23

## 1. Audit Scope

This audit covers the Markdown requirement, architecture, tracker, migration, implementation-note, and design documents under `docs/`, plus the existing UI prototype files under `docs/ui-prototypes/`.

The audit also checked the current repository implementation to avoid documenting stale assumptions:

- Root workspace: npm workspaces with `apps/*` and `packages/*`.
- Current app: `apps/passport-web`, Next.js 14 App Router, React 18, TypeScript.
- Database: PostgreSQL through Prisma 5, schema at `prisma/schema.prisma`.
- Auth: custom email/password auth, bcrypt password hashing, Prisma `Session`, HTTP-only `climate-passport-session` cookie.
- Current domain coverage in Prisma: users, roles, sessions, events, tracks, institutions, speakers, agenda, registrations, check-ins, point transactions, invitations, special passes, notifications, certificates, channel session bridges, learning experiences, summer school applications.
- Current route coverage includes public pages, auth, dashboard, admin, certificates, events, speakers, learning experiences, summer school, channel bridge APIs, certificate issue API, learning experience APIs, and admin APIs.

## 2. Latest Product Decisions Applied

The following decisions supersede any older docs:

1. Climate Passport is the Core Platform. SHCW is a Channel Shell.
2. Climate Passport ID must not be year-based, sequential, channel-prefixed, or order-revealing.
3. QR Code must not be a plain URL and must not expose personal data in cleartext.
4. Verifier stays inside Climate Passport Core for now, but must expose independent APIs for shells and future partners.
5. Web and Admin should split over time into `www.climatepassport.org`, `admin.climatepassport.org`, `api.climatepassport.org`, and `verify.climatepassport.org`.
6. Future monorepo direction should be `apps/passport-web`, `apps/passport-admin`, `apps/passport-api`, `packages/passport-core`, `packages/passport-contracts`, `packages/passport-sdk`, and `packages/passport-ui`.
7. SHCW owns CMS/content/channel presentation only. Climate Passport Core owns identity, account, login/register, Passport ID, event registration, learning experience application, certificate, points, achievements, milestones, QR, verifier, check-in, verification, and participation records.

## 3. Classification Legend

- Current authority: keep at top level and use for future development.
- Current support: still valid but supporting, not the primary requirement entry.
- Merged into current docs: valid content migrated into the new current docs, original can be archived.
- Superseded: conflicts with latest decisions or was replaced by newer architecture.
- Historical implementation note: useful as changelog/evidence only; archive.
- Prototype artifact: keep in place unless product asks to remove or regenerate.

## 4. Document Inventory And Recommendation

| File | Theme | Conflict With Latest Decisions | Recommendation | Valid Content To Migrate |
|---|---|---|---|---|
| `CERTIFICATE_HUB_PENDING_FEATURES_TRACKER.md` | Certificate backlog | No direct conflict, but fragmented tracker | Archive after migrating open tasks | Certificate categories, templates, issuance, verification, Passport linkage |
| `CERTIFICATE_HUB_REQUIREMENTS_20260520.md` | Certificate Hub requirement note | No direct conflict | Archive after merging | Certificate Hub as platform module, lifecycle, linkage to achievements/points/milestones |
| `CHANNEL_SESSION_BRIDGE_PENDING_FEATURES_TRACKER.md` | SHCW bridge backlog | Needs broader channel shell framing | Archive after merging | One-time bridge status, rate limit, replay monitoring, targetPath allowlist |
| `CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md` | Platform backlog | Some old open decisions now decided | Keep and update | Consolidated next work queue |
| `CONTEXT_CONTINUITY_20260518.md` | Migration context | Some old source framing now superseded by Core/Shell decision | Archive after merging | Ownership separation, mature flow migration guardrails |
| `LEARNING_EXPERIENCES_PENDING_FEATURES_TRACKER.md` | LE backlog | No direct conflict, but fragmented tracker | Archive after merging | LE migration compatibility, cohort ops, Passport linkage |
| `LEARNING_EXPERIENCE_TARGET_DOMAIN_20260520.md` | LE bounded context | Still valid | Archive after merging into current requirements/status | LE is Program/Application, not Event; Event links are subordinate |
| `MIGRATION_BOOTSTRAP_20260518.md` | Migration bootstrap note | Historical | Archive | Repository start evidence |
| `MIGRATION_EXTRACTION_BOOTSTRAP_20260520.md` | Extraction script note | Historical | Archive | Extraction script status |
| `MIGRATION_IMPORT_BOOTSTRAP_20260520.md` | Import script note | Historical | Archive | Import pipeline status |
| `MIGRATION_PARTICIPATION_EXTENSION_20260520.md` | Participation migration note | Historical | Archive | Verifiers/checkins/points/invitations/special passes included |
| `MIGRATION_PEOPLE_AGENDA_EXTENSION_20260520.md` | People/agenda migration note | Historical | Archive | Institutions, speakers, roles, agenda included |
| `MIGRATION_SCRIPT_BOOTSTRAP_20260520.md` | Migration script scaffold note | Historical | Archive | Migration command baseline |
| `MODULE_MIGRATION_MATRIX_20260520.md` | Core vs shell module split | Mostly valid but SHCW boundary now stricter | Archive after merging | Module ownership matrix and priority rules |
| `PASSPORT_PLATFORM_INCREMENT_20260520_PHASE2.md` | Implementation note | Historical | Archive | Notifications, bridge, LE schema/API shipped |
| `PASSPORT_PLATFORM_INCREMENT_20260520_PHASE3.md` | Implementation note | Historical | Archive | LE closed loop and admin lifecycle shipped |
| `PASSPORT_PRISMA_LOADER_INTEGRATION_20260520.md` | Implementation note | Historical | Archive | Prisma loader introduced |
| `PASSPORT_SEED_BASELINE_20260520.md` | Implementation note | Historical | Archive | Seed baseline introduced |
| `PASSPORT_SERVER_DATA_LAYER_20260520.md` | Implementation note | Historical | Archive | Server data layer introduced |
| `PASSPORT_WEB_BOOTSTRAP_20260520.md` | Implementation note | Historical | Archive | Initial Next.js app bootstrap |
| `PASSPORT_WEB_CONTENT_AND_MESSAGING_20260520.md` | Implementation note | Historical; SHCW content ownership now narrower | Archive | Static pages, messages, notifications evidence |
| `PASSPORT_WEB_CONTENT_CLEANUP_20260520.md` | Implementation note | Historical | Archive | Copy cleanup evidence |
| `PASSPORT_WEB_DESIGN_ALIGNMENT_20260520.md` | Implementation note | Historical | Archive | Design alignment evidence |
| `PASSPORT_WEB_FOUNDATION_ADAPTATION_20260520.md` | Implementation note | Historical | Archive | Foundation CSS/app shell adaptation |
| `PASSPORT_WEB_PRODUCTIZATION_PASS_20260520.md` | Implementation note | Historical | Archive | Productization evidence |
| `PASSPORT_WEB_PROFESSIONAL_REDESIGN_20260521.md` | Implementation note | Yes: includes `CP-2026-012480` sample and internal page wording now outdated | Archive and mark superseded | Useful UI polish evidence only |
| `PASSPORT_WEB_RUNNABLE_SYSTEM_20260520.md` | Implementation note | Historical | Archive | Auth/session/admin events status |
| `PLATFORM_ARCHITECTURE_20260518.md` | Platform architecture | Old open decisions now decided | Keep and update | Core/Shell architecture, bounded contexts |
| `PLATFORM_STRUCTURE_BOOTSTRAP_20260518.md` | Structure bootstrap note | Historical; package names have evolved | Archive | Initial workspace structure evidence |
| `PRISMA_SCHEMA_DRAFT_20260520.md` | Schema draft note | Historical; schema now exists | Archive | Schema coverage evidence |
| `SOURCE_TO_TARGET_DATA_MAPPING_20260520.md` | Migration mapping | Mostly valid, but target names are conceptual and current schema differs | Archive after merging key principles | Preserve IDs/timestamps; source-to-target relationships |
| `USER_COMMUNICATION_PENDING_FEATURES_TRACKER.md` | User messaging backlog | No direct conflict, but fragmented tracker | Archive after merging | Preferences, feed actions, contact workflows |
| `climate-passport-design-foundation.md` | Design system | No direct conflict | Keep as current support | UI style, color, typography, accessibility |
| `climate-passport-development-specification.md` | Long-form product spec | Yes: old year-based ID example, generic API/tree assumptions, NextAuth mention | Keep and update as supporting spec | Product vision, modules, MVP scope, design principles |
| `ui-prototypes/*.html` | Static prototypes | No direct conflict found in file inventory; content may become visually stale | Keep in place as prototype artifacts | Visual reference only, not authority |

## 5. Recommended Current Authority Set

Create or keep these top-level docs:

1. `docs/README.md`
2. `docs/CURRENT_PRODUCT_REQUIREMENTS.md`
3. `docs/CURRENT_ARCHITECTURE_DECISIONS.md`
4. `docs/PASSPORT_ID_AND_QR_SPEC.md`
5. `docs/CHANNEL_SHELL_INTEGRATION_SPEC.md`
6. `docs/CURRENT_IMPLEMENTATION_STATUS.md`
7. `docs/CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md`
8. `docs/PLATFORM_ARCHITECTURE_20260518.md`
9. `docs/climate-passport-development-specification.md`
10. `docs/climate-passport-design-foundation.md`

## 6. Files Recommended For Archive

Archive these files under `docs/archive/` because their useful content is merged or they are historical implementation notes:

- `CERTIFICATE_HUB_PENDING_FEATURES_TRACKER.md`
- `CERTIFICATE_HUB_REQUIREMENTS_20260520.md`
- `CHANNEL_SESSION_BRIDGE_PENDING_FEATURES_TRACKER.md`
- `CONTEXT_CONTINUITY_20260518.md`
- `LEARNING_EXPERIENCES_PENDING_FEATURES_TRACKER.md`
- `LEARNING_EXPERIENCE_TARGET_DOMAIN_20260520.md`
- `MIGRATION_BOOTSTRAP_20260518.md`
- `MIGRATION_EXTRACTION_BOOTSTRAP_20260520.md`
- `MIGRATION_IMPORT_BOOTSTRAP_20260520.md`
- `MIGRATION_PARTICIPATION_EXTENSION_20260520.md`
- `MIGRATION_PEOPLE_AGENDA_EXTENSION_20260520.md`
- `MIGRATION_SCRIPT_BOOTSTRAP_20260520.md`
- `MODULE_MIGRATION_MATRIX_20260520.md`
- `PASSPORT_PLATFORM_INCREMENT_20260520_PHASE2.md`
- `PASSPORT_PLATFORM_INCREMENT_20260520_PHASE3.md`
- `PASSPORT_PRISMA_LOADER_INTEGRATION_20260520.md`
- `PASSPORT_SEED_BASELINE_20260520.md`
- `PASSPORT_SERVER_DATA_LAYER_20260520.md`
- `PASSPORT_WEB_BOOTSTRAP_20260520.md`
- `PASSPORT_WEB_CONTENT_AND_MESSAGING_20260520.md`
- `PASSPORT_WEB_CONTENT_CLEANUP_20260520.md`
- `PASSPORT_WEB_DESIGN_ALIGNMENT_20260520.md`
- `PASSPORT_WEB_FOUNDATION_ADAPTATION_20260520.md`
- `PASSPORT_WEB_PRODUCTIZATION_PASS_20260520.md`
- `PASSPORT_WEB_PROFESSIONAL_REDESIGN_20260521.md`
- `PASSPORT_WEB_RUNNABLE_SYSTEM_20260520.md`
- `PLATFORM_STRUCTURE_BOOTSTRAP_20260518.md`
- `PRISMA_SCHEMA_DRAFT_20260520.md`
- `SOURCE_TO_TARGET_DATA_MAPPING_20260520.md`
- `USER_COMMUNICATION_PENDING_FEATURES_TRACKER.md`

## 7. Conflicts Found

1. `climate-passport-development-specification.md` shows a year-based sequential ID example `CP-2035-000184`; this conflicts with the latest Passport ID decision.
2. `PASSPORT_WEB_PROFESSIONAL_REDESIGN_20260521.md` records `CP-2026-012480`; this conflicts with the latest Passport ID decision.
3. `PLATFORM_ARCHITECTURE_20260518.md` leaves verifier app split and web/admin split as open decisions; these are now decided.
4. Several old docs treat mature SHCW flows as preserved UI baselines. The valid part is continuity and non-regression; the new authority is stricter: SHCW is only a Channel Shell and cannot own Core identity, QR, verifier, registration, certificate, points, achievements, milestones, or participation records.
5. Some docs describe `packages/passport-ui-flows`; the latest monorepo direction replaces this with `packages/passport-ui` plus `packages/passport-core`.

## 8. Uncertain Items

1. QR signing standard and key storage provider for signed opaque event tokens remain open.
2. Final certificate rendering/storage provider is not yet decided.
3. Deployment domains are recommended but DNS, Vercel project split, and environment separation remain to be implemented.
4. Exact public verification URL pattern under `verify.climatepassport.org` remains open.
5. Person/Institution model evolution is decided directionally as Core Master Data, but the schema migration from current `Speaker` / `Institution` models still needs design.
