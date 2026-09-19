# Climate Passport Docs

Last organized: 2026-09-18

## Current Development Entry Point

- [2026-09-19 requirements and implementation audit](REQUIREMENTS_IMPLEMENTATION_AUDIT_20260919.md): current code-versus-requirements findings, release blockers, verified test evidence, multi-programme foundation gaps, and ordered remediation criteria. This is the latest read-only audit and does not change Summer School scope.
- [Certificate Phase 1 agent handoff](AGENT_HANDOFF_20260918_CERTIFICATE_PHASE1.md): exact repository state, verified CP-TODO-218~227 boundary, current stop point and CP-TODO-228 implementation/acceptance instructions for the next agent.
- [Functional development requirements V2](CLIMATE_PASSPORT_FUNCTIONAL_REQUIREMENTS_V2.md): current baseline with V2.1 strict separation; shared CP capabilities and independently developed programme business layers. CP-FR-063/064/065 and CP-TODO-254/255/256 are external requirements, excluded from CP delivery.
- [Three-programme requirements synthesis](PROGRAMME_REQUIREMENTS_SYNTHESIS_20260918.md): full source traceability for Future Stewards, SHCW 2027 and the Convener programme, conflicts and code gaps.
- [2026-09-18 requirements/implementation gap audit](REQUIREMENTS_IMPLEMENTATION_GAP_AUDIT_20260918.md): current working-tree findings, evidence limits, and corrections to historical completion claims.
- [2026-09-18 development requirements and plan](DEVELOPMENT_REQUIREMENTS_AND_PLAN_20260918.md): retained security/certificate work, CP-TODO-218 through 239; V2 refines sequencing for independently releasable programme journeys.

These documents refine execution and acceptance; they do not override product/privacy authority below. Summer-school business flows remain frozen. Existing uncommitted work is part of the review baseline, not permission to commit, push or deploy. Historical reports retain their original evidence date; use the dated current review for present gaps.

## Current Authority

Read these files first for current product and architecture decisions:

1. `CURRENT_PRODUCT_REQUIREMENTS.md`
2. `CURRENT_ARCHITECTURE_DECISIONS.md`
3. `CLIMATE_PASSPORT_FUNCTIONAL_REQUIREMENTS_V2.md`
4. `PASSPORT_ID_AND_QR_SPEC.md`
5. `CHANNEL_SHELL_INTEGRATION_SPEC.md`
6. `CERTIFICATE_MODULE_PRODUCT_REQUIREMENTS.md`
7. `CURRENT_IMPLEMENTATION_STATUS.md`
8. `CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md`

V2 incorporates programme inputs under the user's latest boundary: CP develops reusable digital infrastructure only; all programme-specific business systems are independently developed by their respective teams and integrated through contracts. This supersedes source suggestions to host programme business modules inside CP. Passport ID and topic safety requirements remain valid. V1 retains original IDs/history; `ref_docx/` remains read-only input, not development authorization for bespoke modules.

Supporting current references:

- `PLATFORM_ARCHITECTURE_20260518.md`: updated architecture baseline with latest decisions applied.
- `climate-passport-development-specification.md`: long-form product specification, updated to remove outdated ID and architecture assumptions.
- `climate-passport-design-foundation.md`: current visual design foundation.
- `DOCS_AUDIT_REPORT.md`: 2026-05-23 documentation audit and archive rationale.
- `UI_PROTOTYPE_ALIGNMENT_AUDIT.md`: historical page audit plus current visual acceptance requirements; page existence is not proof of visual fidelity.
- `PROJECT_TAKEOVER_BASELINE_20260912.md`: dated project handover baseline; current remaining work is reconciled in the 2026-09-18 audit/plan.
- `CLIMATE_PASSPORT_FUNCTIONAL_REQUIREMENTS_V1.md`: previous functional baseline and original CP-FR definitions; read together with the current V2 scope and acceptance refinements.
- `PHASED_EXECUTION_P0_P2_20260523.md`: phase-by-phase execution record with done/pending items and baseline test results.
- `trackers/`: module-level pending-feature trackers (currently certificate and summer-school modules).
- `ui-prototypes/`: static UI prototype artifacts. For future development, ignore prototype hero/footer as binding references; use the rest of each prototype as the preferred layout and UI/UX reference when content is consistent with current product requirements. Data logic remains governed by Core platform docs.

## Product Direction

Climate Passport is the shared digital foundation. Programme business systems and channel experiences are independently developed outside CP; CP does not implement or contain their bespoke modules. Common infrastructure does not change code, data-model or delivery ownership.

This means Climate Passport Core owns identity, account, login/register, Passport ID, event registration, learning experience application, certificate, points, achievements, milestones, QR, verifier, check-in, verification, and participation records.

SHCW owns CMS/brand presentation plus its private annual operations: event-host submissions, Speaker/Venue/Volunteer applications and internal review, invitations and preparation. Approved formal activities enter CP via controlled source mappings; CP-managed participation transactions are not duplicated in SHCW. FS and the Convener programme retain their own learning/editorial and membership/contribution-policy authority respectively.

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
