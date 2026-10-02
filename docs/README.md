# Climate Passport Docs

Last organized: 2026-10-02 (master directive, partner requirements, and cross-site governance entrypoints merged)

## Current Development Entry Point

- [2026-10-02 Activity A/P role boundaries](BUGFIX_ACTIVITY_ROLE_BOUNDARIES_20261002.md): local P0 implementation and source-level evidence; certificate approval/auto-issuance and verifier scan acceptance remain open.
- [2026-09-19 requirements and implementation audit](REQUIREMENTS_IMPLEMENTATION_AUDIT_20260919.md): current code-versus-requirements findings, release blockers, verified test evidence, multi-programme foundation gaps, and ordered remediation criteria. This is the latest read-only audit and does not change Summer School scope.
- [Certificate Phase 1 agent handoff](AGENT_HANDOFF_20260918_CERTIFICATE_PHASE1.md): exact repository state, verified CP-TODO-218~227 boundary, current stop point and CP-TODO-228 implementation/acceptance instructions for the next agent.
- [Functional development requirements V2](CLIMATE_PASSPORT_FUNCTIONAL_REQUIREMENTS_V2.md): current baseline with V2.1 strict separation; shared CP capabilities and independently developed programme business layers. CP-FR-063/064/065 and CP-TODO-254/255/256 are external requirements, excluded from CP delivery.
- [Three-programme requirements synthesis](PROGRAMME_REQUIREMENTS_SYNTHESIS_20260918.md): full source traceability for Future Stewards, SHCW 2027 and the Convener programme, conflicts and code gaps.
- [2026-09-18 requirements/implementation gap audit](REQUIREMENTS_IMPLEMENTATION_GAP_AUDIT_20260918.md): current working-tree findings, evidence limits, and corrections to historical completion claims.
- [2026-09-18 development requirements and plan](DEVELOPMENT_REQUIREMENTS_AND_PLAN_20260918.md): retained security/certificate work, CP-TODO-218 through 239; V2 refines sequencing for independently releasable programme journeys.

These documents refine execution and acceptance; they do not override product/privacy authority below. Summer-school business flows remain frozen. Existing uncommitted work is part of the review baseline, not permission to commit, push or deploy. Historical reports retain their original evidence date; use the dated current review for present gaps.

## Current Authority

Read [Climate Passport 最高开发指导纲领](CP_MASTER_DEVELOPMENT_DIRECTIVE.md) first. Effective 2026-09-22, it is the highest-priority product and development authority for this repository. It contains conclusions, requirements, boundaries, delivery order, and acceptance criteria. All documents below are subordinate; conflicting historical text or prototypes must not override it.

Then read the relevant detailed requirements and implementation records:

1. `CURRENT_PRODUCT_REQUIREMENTS.md`
2. `CURRENT_ARCHITECTURE_DECISIONS.md`
3. `CLIMATE_PASSPORT_FUNCTIONAL_REQUIREMENTS_V2.md`
4. `PASSPORT_ID_AND_QR_SPEC.md`
5. `CHANNEL_SHELL_INTEGRATION_SPEC.md`
6. `CERTIFICATE_MODULE_PRODUCT_REQUIREMENTS.md`
7. `CURRENT_IMPLEMENTATION_STATUS.md`
8. `CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md`
9. `PARTNER_IDENTITY_AND_TRUST_REQUIREMENTS.md`

V2 incorporates programme inputs under the user's latest boundary: CP develops reusable digital infrastructure only; all programme-specific business systems are independently developed by their respective teams and integrated through contracts. This supersedes source suggestions to host programme business modules inside CP. Passport ID and topic safety requirements remain valid. V1 retains original IDs/history; `ref_docx/` remains read-only input, not development authorization for bespoke modules.

The partner requirements provide detailed identity/trust rules under the master directive. Requirements are not release-completion claims. Exact trust tiers and reward amounts require approval before implementation; blockchain anchoring remains outside the current development plan.

Supporting current references:

- `PLATFORM_ARCHITECTURE_20260518.md`: updated architecture baseline with latest decisions applied.
- `climate-passport-development-specification.md`: long-form product specification, updated to remove outdated ID and architecture assumptions.
- `climate-passport-design-foundation.md`: current visual design foundation.
- `DOCS_AUDIT_REPORT.md`: 2026-05-23 documentation audit and archive rationale.
- `UI_PROTOTYPE_ALIGNMENT_AUDIT.md`: historical page audit plus current visual acceptance requirements; page existence is not proof of visual fidelity.
- `PROJECT_TAKEOVER_BASELINE_20260912.md`: dated project handover baseline; current remaining work is reconciled in the 2026-09-18 audit/plan.
- `CLIMATE_PASSPORT_FUNCTIONAL_REQUIREMENTS_V1.md`: previous functional baseline and original CP-FR definitions; read together with the current V2 scope and acceptance refinements.
- `PHASED_EXECUTION_P0_P2_20260523.md`: phase-by-phase execution record with done/pending items and baseline test results.
- `OPEN_API_V1_zh.md`: current contract for the outward machine surface — `/api/v1/open/**` is the only stable API-key entry point (`/api/external/**` was merged into it and deleted). Machine-readable spec: `openapi/v1.yaml`. Decision ledger (what the owner ruled, verbatim): `SPEC_V1_OPENAPI_DECISIONS_20260921.md`.
- `SPEC_V1_OPENAPI_DECISIONS_20260921.md`: dated decision record for Open API v1 — seven rulings plus four same-day follow-ups; frozen once written, new understanding goes into a new dated entry.
- `DOCUMENT_CONVENTIONS.md`: how this directory itself is written and checked — layering, naming, date headers, the three evidence layers, and the rule that every number must be re-run or re-grepped before it is written down.
- `trackers/`: module-level pending-feature trackers (certificate, activities, summer-school and system-management modules).
- `ui-prototypes/`: static UI prototype artifacts. For future development, ignore prototype hero/footer as binding references; use the rest of each prototype as the preferred layout and UI/UX reference when content is consistent with current product requirements. Data logic remains governed by Core platform docs.

## Product Direction

Climate Passport is the shared digital foundation. Programme business systems and channel experiences are independently developed outside CP; CP does not implement or contain their bespoke modules. Common infrastructure does not change code, data-model or delivery ownership.

This means Climate Passport Core owns identity, account, login/register, Passport ID, event registration, learning experience application, certificate, points, achievements, milestones, QR, verifier, check-in, verification, and participation records.

SHCW owns CMS/brand presentation plus its private annual operations: event-host submissions, Speaker/Venue/Volunteer applications and internal review, invitations and preparation. Approved formal activities enter CP via controlled source mappings; CP-managed participation transactions are not duplicated in SHCW. FS and the Convener programme retain their own learning/editorial and membership/contribution-policy authority respectively.

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
- New outward Open API work should update `OPEN_API_V1_zh.md` and `openapi/v1.yaml` together, then re-run `node artifacts/check-openapi.mjs`; owner rulings are recorded as a new dated decision doc rather than rewritten into an old one.
- Before adding or editing any file here, follow `DOCUMENT_CONVENTIONS.md` (naming, date headers, evidence layers, re-verified numbers).
- Historical notes should go to `docs/archive/` after their useful content has been merged.

## 2026-10-01 Approved 跨站业务治理

- [CP业务规则主册](CP_BUSINESS_RULES.md)：统一规则ID、适用范围、生效版本、用户决定与实现验收状态；五站共同引用。
- [治理User Guide](CP_GOVERNANCE_USER_GUIDE.md)：仅已验路径，未实现项显式标记。
