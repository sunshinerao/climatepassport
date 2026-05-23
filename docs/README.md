# Climate Passport Docs

Last organized: 2026-05-23

## Current Authority

Read these files first for current product and architecture decisions:

1. `CURRENT_PRODUCT_REQUIREMENTS.md`
2. `CURRENT_ARCHITECTURE_DECISIONS.md`
3. `PASSPORT_ID_AND_QR_SPEC.md`
4. `CHANNEL_SHELL_INTEGRATION_SPEC.md`
5. `CERTIFICATE_MODULE_PRODUCT_REQUIREMENTS.md`
6. `CURRENT_IMPLEMENTATION_STATUS.md`
7. `CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md`

Supporting current references:

- `PLATFORM_ARCHITECTURE_20260518.md`: updated architecture baseline with latest decisions applied.
- `climate-passport-development-specification.md`: long-form product specification, updated to remove outdated ID and architecture assumptions.
- `climate-passport-design-foundation.md`: current visual design foundation.
- `DOCS_AUDIT_REPORT.md`: 2026-05-23 documentation audit and archive rationale.
- `UI_PROTOTYPE_ALIGNMENT_AUDIT.md`: current audit of implemented pages versus UI prototypes.
- `PHASED_EXECUTION_P0_P2_20260523.md`: phase-by-phase execution record with done/pending items and baseline test results.
- `trackers/`: module-level pending-feature trackers (currently certificate and summer-school modules).
- `ui-prototypes/`: static UI prototype artifacts. For future development, ignore prototype hero/footer as binding references; use the rest of each prototype as the preferred layout and UI/UX reference when content is consistent with current product requirements. Data logic remains governed by Core platform docs.

## Product Direction

Climate Passport is the Core Platform.

SHCW is a Channel Shell.

This means Climate Passport Core owns identity, account, login/register, Passport ID, event registration, learning experience application, certificate, points, achievements, milestones, QR, verifier, check-in, verification, and participation records.

SHCW owns CMS content, news, agenda display, event pages, speakers presentation, media center, partner display, and SHCW branding.

SHCW and future partner channels must call Climate Passport through API, SDK, or embedded flows instead of reimplementing Core capabilities.

## Archive Policy

`docs/archive/` contains old implementation notes, migration notes, fragmented trackers, and superseded requirement documents. Archived files are preserved for history but are not current requirements unless a current authority document explicitly points back to them.

Do not use archived files to override current decisions.

## Maintenance Rules

- New product decisions should update `CURRENT_PRODUCT_REQUIREMENTS.md` and `CURRENT_ARCHITECTURE_DECISIONS.md` first.
- New ID or QR work should update `PASSPORT_ID_AND_QR_SPEC.md`.
- New channel integration work should update `CHANNEL_SHELL_INTEGRATION_SPEC.md`.
- New certificate product decisions should update `CERTIFICATE_MODULE_PRODUCT_REQUIREMENTS.md`.
- New implementation progress should update `CURRENT_IMPLEMENTATION_STATUS.md` and `CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md`.
- New UI prototype/page alignment decisions should update `UI_PROTOTYPE_ALIGNMENT_AUDIT.md`.
- Historical notes should go to `docs/archive/` after their useful content has been merged.
