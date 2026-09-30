# Climate Passport Docs

Last organized: 2026-05-23; authority decisions updated: 2026-09-22

## Current Authority

Read [Climate Passport 最高开发指导纲领](CP_MASTER_DEVELOPMENT_DIRECTIVE.md) first. Effective 2026-09-22, it is the highest-priority product and development authority for this repository. It contains conclusions, requirements, boundaries, delivery order, and acceptance criteria. All documents below are subordinate; conflicting historical text or prototypes must not override it.

Then read the relevant detailed requirements and implementation records:

1. `CURRENT_PRODUCT_REQUIREMENTS.md`
2. `CURRENT_ARCHITECTURE_DECISIONS.md`
3. `PASSPORT_ID_AND_QR_SPEC.md`
4. `CHANNEL_SHELL_INTEGRATION_SPEC.md`
5. `CERTIFICATE_MODULE_PRODUCT_REQUIREMENTS.md`
6. `CURRENT_IMPLEMENTATION_STATUS.md`
7. `CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md`
8. [Partner Identity And Trust Requirements](PARTNER_IDENTITY_AND_TRUST_REQUIREMENTS.md): 2026-09-22 decisions on optional partner-driven Passport creation, separate passwords/verified claim, institution/activity trust-based rewards, and blockchain anchoring outside the current development plan.

The partner requirements provide detailed identity/trust rules under the master directive. Requirements are not release-completion claims. Exact trust tiers and reward amounts require approval before implementation; blockchain anchoring remains outside the current development plan.

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

Independent partner systems may retain their own business workflows, databases, and passwords. They submit authorized confirmed facts and invoke CP services through Open API; they are not all thin shells. Optional CP provisioning and later account activation do not require redirecting the partner's business operations into CP.

## Archive Policy

`docs/archive/` contains old implementation notes, migration notes, fragmented trackers, and superseded requirement documents. Archived files are preserved for history but are not current requirements unless a current authority document explicitly points back to them.

Do not use archived files to override current decisions.

## Maintenance Rules

- Approved product decisions must first update `CP_MASTER_DEVELOPMENT_DIRECTIVE.md`, then the affected product, architecture, module requirements, and tracker documents. Keep the master directive conclusion-only; put analysis and implementation evidence in separate records.
- New ID or QR work should update `PASSPORT_ID_AND_QR_SPEC.md`.
- New channel integration work should update `CHANNEL_SHELL_INTEGRATION_SPEC.md`.
- Partner provisioning, trust assessment, and reward-policy changes should also update `PARTNER_IDENTITY_AND_TRUST_REQUIREMENTS.md` and the main tracker. Do not describe requirements as implemented without code and acceptance evidence.
- New certificate product decisions should update `CERTIFICATE_MODULE_PRODUCT_REQUIREMENTS.md`.
- New implementation progress should update `CURRENT_IMPLEMENTATION_STATUS.md` and `CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md`.
- New UI prototype/page alignment decisions should update `UI_PROTOTYPE_ALIGNMENT_AUDIT.md`.
- Historical notes should go to `docs/archive/` after their useful content has been merged.
