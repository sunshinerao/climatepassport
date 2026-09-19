# Project Takeover Baseline

Date: 2026-09-12

## Purpose

This document is the active delivery baseline after the project-management handover. It translates the early nine-loop product vision into a sequenced Climate Passport delivery plan without overriding the current Core-versus-Channel-Shell architecture.

## Phase 3A update (2026-09-13)

The local baseline now includes an additive, locally applied verified-portfolio/share migration (`20260913060000_portfolio_phase3a`). It is provider-independent and token-only for public sharing; no production release is implied. LMS provider/apply, jobs, recruitment/matching, AI scoring, DID/VC, generic uploads, partner search and public profile lookup remain deferred.

## Phase 4 internal redemption accounting update (2026-09-13)

The local baseline includes additive, locally applied migrations `20260913110000_redemption_accounting_phase4` and corrective `20260913111000_redemption_accounting_user_available`, plus a server-only internal accounting service. It introduces positive-point redemption intents and immutable two-posting journals for reserve, cancel, expire, settle, and refund. `USER_AVAILABLE` is accounting representation only; available points remain the unchanged legacy `User.points` less outstanding `USER_RESERVED` credits until a separately approved ledger cutover. Actor scope is owner-or-admin, with settle/refund ADMIN-only; audit and in-app notification metadata is transactional and intentionally non-sensitive. The provider adapter registry is empty: no user/admin UI, endpoint, offer/catalog, inventory, money/payment, provider call, webhook, worker, or fulfillment exists. Production rollout and every provider capability remain separately gated by `REDEMPTION_ACCOUNTING_PHASE4_SPEC.md`.

## Phase 4 Activity AI content-draft update (2026-09-13)

The local baseline includes additive, locally applied migration `20260913120000_activity_ai_content_drafts` and a default-disabled, ADMIN-only exact-Activity draft workflow. It sends only bounded public title/subtitle/summary/description to one configured native-fetch provider; no client prompt, IDs, users, applicants, participation, speakers, agenda, community, certificates, or portfolio data is used. Generated output is isolated and cannot alter Activity. An ADMIN must edit if needed, approve, and explicitly confirm publishing; only then do locale-correct fields change. Audit records contain metadata only, and purge defaults to dry-run. This is code/local-migration evidence only—not production provider configuration or deployment—and introduces no chat/RAG, matching, scoring, recommendation, moderation decision, profiling, uploads, or browsing. External provider, security, privacy, retention, shared-limiter, operational review, and browser/E2E gates remain required.

The early vision is a product-direction reference, not an implementation contract. Current authority remains the documents listed in `docs/README.md`, especially `CURRENT_PRODUCT_REQUIREMENTS.md` and `CURRENT_ARCHITECTURE_DECISIONS.md`.

## Phase 3 Person/Institution compatibility master-data update (2026-09-13)

The local baseline now also includes an additive, locally applied Person/Institution compatibility migration (`20260913070000_person_institution_master_data_phase3`). It adds `Person`, `PersonAffiliation`, `PersonRoleProfile`, verification/role enums, a nullable `Speaker.personId` link, and additive `Institution` governance/verification/alias/parent/contact fields. A deterministic speaker-to-person backfill script defaults to `--dry-run` and requires `--apply` to write. ADMIN-only APIs and admin pages under the shared shell provide search/list/detail/edit/link flows for People and Institutions. Existing public Speaker/Institution presentation flows are unchanged. Production migration, recruitment/matching/partner search/public directory/AI/DID/VC remain deferred; see `docs/PERSON_INSTITUTION_MASTER_DATA_PHASE3_PLAN.md`.

## Controlled PROJECT application update (2026-09-13)

The local baseline includes additive local-only migration `20260913080000_project_application_consent_phase3` and a consent-controlled PROJECT subset of ActivityApplication. It requires `PROJECT_APPLICATION_CONSENT_V1`, records selected profile/portfolio disclosure fields, validates only active applicant-owned portfolio share-link references, and never exposes raw tokens. ADMIN and exact project organizer review; EVENT_MANAGER otherwise denies. Only APPROVED, REJECTED, and WAITLISTED are permitted, with idempotent participation creation on approval and safe audit/in-app notifications. No production deployment is implied. Interest-only behavior, team applications, jobs/recruitment/candidate search, institution browsing, matching, AI, and any public applicant directory are explicitly deferred. See `PROJECT_INTEREST_APPLICATION_PRIVACY_OPERATIONS.md`.

## Repository Baseline

- Local branch: `main`.
- Remote tracking: `origin/main` at `https://github.com/sunshinerao/climatepassport.git`.
- Sync state at audit time: local `main` equals `origin/main`.
- Existing user-staged file: `.github/copilot-instructions.md`. It was not created or changed by this handover and remains outside this work.
- Application: `apps/passport-web`, using Next.js 14 App Router, React 18, TypeScript, Prisma 5, and PostgreSQL.
- Database migration status: 15 migrations discovered; local database schema is up to date.
- Quality baseline: `npm run db:validate`, `npm run lint`, `npm test`, and `npm run build` all pass. The test suite now has **324** passing tests, including the Phase 0 Core API runtime regression package for auth, channel bridge, QR/verifier, certificate lifecycle, artifact authorization, public minimum-disclosure verify, and parameterized admin RBAC. This is mocked Node route coverage and does not replace deployed browser E2E or production configuration validation.

## Product Position

Climate Passport is the system of record for trusted climate identity, participation, learning records, certificates, points, achievements, milestones, QR verification, and partner-channel delivery.

Shanghai Climate Week is a channel shell. It must consume Core capabilities and must not duplicate identity, registration, QR, verifier, certificates, points, achievements, milestones, or participation state.

## Delivery Scope

### Existing Deliverable Foundation

- Email/password account flows, email verification and password reset, sessions, roles, stable non-predictable Passport IDs, profile maintenance, and audit logging.
- Opaque identity and event check-in QR tokens, role-gated verifier scanning, and event-specific verifier authorization.
- Code-level shared-aware rate limiting protects critical mutations and public verification. It is configurable through `RATE_LIMIT_MODE`, `RATE_LIMIT_TRUST_PROXY`, `RATE_LIMIT_REST_URL`, and `RATE_LIMIT_REST_TOKEN`; this does not claim production configuration or deployment validation, which remains pending.
- Activity lifecycle: discovery, application, review, participation, check-in, tasks, submissions, rewards, milestones, and baseline leaderboards.
- Learning Experience application and completion workflow with certificate, points, and milestone writeback.
- Certificate issue, public verification with minimum-disclosure controls, downloads, revocation, user credential surfaces, and initial admin surfaces.
- Bounded code-level automatic Activity certificate issuance after authoritative unified scanner check-in only, backed by local migration `20260913030000_activity_checkin_certificate_issuance`; this is not production deployment evidence.
- Private provider-neutral certificate artifact delivery for printable HTML, backed by local-only migration `20260913040000_certificate_artifact_storage_phase1`; this is not production volume/HTTP-adapter deployment or PDF-rendering evidence.
- Points ledger, achievements, badges, milestones, and Chinese/English core user experience.

### Explicitly Not Yet Deliverable

- KYC, DID, W3C Verifiable Credential issuance, blockchain anchoring, wallets, or transferable tokens.
- External Tutor LMS or other LMS SSO, catalog, enrollment, progress synchronization, and signed webhooks.
- Community feed, groups, messaging, moderation, or social graph.
- Jobs, recruiter tools, talent matching, partner collaboration marketplace, and consented talent sharing.
- Storefront integration, point redemption, inventory, fulfillment, settlement, or redemption fraud controls.
- AI coaching, RAG, matching, recommendation engine, or governed analytics. Current AI use is limited to activity-highlight assistance.
- Production separation into Web, Admin, API, and Verify deployments.
- Legacy Event or direct activity-checkin certificate triggers, general certificate rules, background jobs, email, PDF generation, and object storage.

## Priority Risks

1. Credential verification no longer accepts non-bcrypt stored passwords as a legacy fallback; the code has been hardened in this change. However, any production database that still contains plaintext or malformed stored passwords must be migrated using `scripts/migrate-legacy-password-hashes.mjs` (dry-run, review, then `--apply`) before launch. Do not treat the code change as a production migration.
2. Rate limits are process-local and rely on forwarding headers. They are insufficient for horizontally scaled or serverless deployment.
3. Event-only Invitation/Special Pass QR issuance, revocation, expiry, single-use admission, and opaque audit correlations are implemented; the local migration `20260913000000_invitation_special_pass_event_phase0` is not production evidence. Activity verifier authorization is code-level complete through explicit `ActivityVerifier` assignment plus organizer ownership enforcement. Activity invitation/pass QR remains unimplemented. Production shared-rate-limit configuration, QR key rotation, deployment, and end-to-end validation remain pending. Channel-session bridge token consumption is atomic and replay attempts are audited.
4. The legacy Event/Registration model overlaps the newer Activity domain. A canonical migration boundary is required before expanding participation features.
5. Certificate storage/rendering operations and browser E2E coverage are not yet launch-ready. Runtime mocked API coverage for certificate lifecycle, artifact authorization, and public verification is in place and passing.
6. Documentation contains stale status claims. For example, the activity tracker says a migration is undeployed while the audited local migration status reports the schema is current. Status documents must be verified before being used as deployment evidence.

## Phased Delivery Plan

### Phase 0: Trust And Launch Readiness

Objective: make the existing trusted credential loop safe, observable, and testable for a controlled launch.

- Remove plaintext password verification fallback and provide the controlled migration script (`scripts/migrate-legacy-password-hashes.mjs`) for production data. The actual production migration remains a deployment action: dry-run, review count, `--apply`, confirm zero non-bcrypt rows.
- Replace in-memory rate limiting with a shared, proxy-aware implementation for authentication, email, bridge, QR, and verifier endpoints.
- Add distributed rate limits and operational replay metrics to the already atomic, audit-logged channel bridge.
- Validate the implemented Event-only opaque Invitation/Special Pass QR lifecycle in production; Activity invitation/pass QR remains unimplemented despite completed code-level Activity verifier authorization.
- Establish one canonical event/activity participation and check-in ownership path; document legacy migration rules.
- Runtime mocked API coverage for account verification, QR/verifier, certificate issue/verify/revoke/restore/regenerate, artifact authorization, public minimum-disclosure verify, channel bridge, and admin RBAC is in place and passing (324 tests). Browser E2E coverage and production configuration validation remain pending.

Exit criteria: no plaintext password acceptance; bridge replay cannot create multiple sessions; all exposed credential/QR mutations are rate-limited in a shared store; critical closed-loop tests are automated; launch runbook and rollback procedure are approved.

### Phase 1: Credential And Partner Operations

Objective: give operators and partners dependable certificate and participation operations.

- Certificate Hub records lifecycle is now code-level complete (bounded admin listing; artifact view/print; link copy; revoke/restore/regenerate; best-effort audit). Notification workflows, external storage, and production deployment remain outstanding.
- Choose and implement certificate artifact storage/rendering with retention, authorization, and operational recovery rules.
- Complete shared admin shell across all admin routes and enforce role-aware menu visibility. **Completed in code:** `app/[locale]/admin/layout.tsx` supplies the one shared shell on every localized admin route; Event Manager Activity Center/scanner scope and ADMIN-only rules/configuration are aligned. Production UI/manual E2E validation remains pending.
- Publish versioned Core API contracts and expand the SDK for shell authentication, registration, verifier, and public verification flows.
- Add migration-validation reports for Passport IDs, check-ins, points, certificates, and participation records.

Exit criteria: an authorized operator can issue, revoke, restore, locate, and audit a credential; a channel shell can use documented Core contracts without duplicating state; critical data migration checks are repeatable.

### Phase 2: Learning Evidence Integration

Objective: connect external learning completion evidence to the Passport record before building a custom learning platform.

- Confirm the first LMS provider and commercial/technical ownership model.
- **Phase 2A completed locally:** generic DRAFT-by-default provider/account/course-mapping boundary, ADMIN-only opaque management, signed receipt-only webhook, replay/idempotency controls, and read-only operator inbox/evidence visibility. No vendor is selected or enabled.
- Implement provider account mapping, signed webhook verification, idempotency, replay protection, enrollment/progress/completion normalization, and failure reconciliation.
- Deliver a minimal course catalog and learning-progress experience only after the provider contract is validated.
- Map verified completions to certificates, points, achievements, competency dimensions, and audit events.

Phase 2B remains blocked on provider selection, production secret-manager resolution, shared limiter operation, an approved worker/parser contract, and reconciliation policy. Phase 2C reviewed application is separately gated; automatic completion/rewards and outbound sync remain prohibited.

Exit criteria: an LMS completion can be safely ingested exactly once, reconciled by an operator, displayed to the learner, and verified through the credential loop.

### Phase 3: Competency Portfolio And Collaboration

Objective: turn verified evidence into a consent-controlled green competency profile and partner discovery value.

- Define a transparent rules-based competency model for learning, action, innovation, organization, and influence.
- Build export and sharing consent controls before exposing portfolio data to institutions.
- Evolve Person and Institution into Core master data, then add organization profiles and partner roles.
- Deliver recruitment/project collaboration only after consent, audit, retention, and matching-governance policies are approved.

Exit criteria: every portfolio score is explainable from verified records; users can control sharing; partner access is scoped and audited.

### Phase 4: Engagement, Redemption, And AI

Objective: expand retention features only after the trusted-record and partner foundations are stable.

- Add community feed/groups/moderation and challenge enhancements using the established Activity model.
- Add point redemption through a selected third-party commerce provider with reserve/settle/refund and reconciliation controls.
- Introduce AI capabilities incrementally, beginning with human-reviewable assistance. No high-impact matching or scoring is released without privacy, evaluation, audit, and appeal controls.
- Evaluate DID, W3C VC, and blockchain anchoring only against concrete interoperability, legal, support, and operating-cost requirements.

Exit criteria: each integration has a signed contract, clear data controller/processor responsibility, idempotent webhook handling, operational dashboards, and incident response procedure.

## Active First Increment

The next development increment is Phase 0. Atomic channel-session bridge redemption and replay audit coverage are complete in this handover change. Credential hardening code is now shipped (plaintext fallback removed, seed/import validators added, one-off migration script with dry-run/`--apply` added). Event-only opaque single-use Invitation/Special Pass QR is implemented and its local migration `20260913000000_invitation_special_pass_event_phase0` was applied locally only, not in production. Activity verifier authorization is code-level complete through explicit assignment and organizer ownership enforcement, while Activity invitation/pass QR remains unimplemented. Runtime mocked API regression coverage for auth, channel bridge, QR/verifier, certificate lifecycle, artifact authorization, and admin RBAC is now in place and passing 324 tests. Remaining high-priority items are production legacy password migration, shared proxy-aware rate-limit configuration, QR key rotation, and production deployment/browser E2E validation.

## Operating Rules

- Before every implementation: inspect the current branch, `origin/main`, worktree changes, relevant authority documents, and existing tests.
- Never overwrite user or concurrent-agent changes. Report conflicts and ask for a decision only when they block the intended change.
- Any Prisma schema or migration change requires `npm run db:sync`, `npm run build`, and `npm test` before proposing deployment.
- Every delivered increment updates implementation status, backlog tracker, relevant authoritative specification, and tests in the same change set.
- Production claims require deployed-environment verification; local migration/build results alone are not deployment evidence.
- The working Phase 1 localization promise is Chinese and English. French and German routes may remain available only when their content quality and operational coverage are explicitly validated.
# 2026-09-13 Certificate Phase 1 local baseline update

The local implementation includes guarded certificate category/template lifecycle and additive `renderSnapshotJson` persistence for reproducible regeneration. The migration was applied to local PostgreSQL only. No production rollout, object storage, PDF service, background job, notification, or CSV capability is claimed.

Certificate Application Phase 1 additionally has additive local-only migration `20260913020000_certificate_applications_phase1`. It adds an independent application/event domain and local code paths for request, review, atomic issue linkage, audit, and in-app notification. This is not a production claim and excludes attachments, external email, background jobs, and certificate rules.

## 2026-09-13 V1 SHCW channel-contract baseline update

`packages/passport-contracts/src/index.ts` now defines the bounded v1 Zod contracts and stable errors. `packages/passport-core/src/channel-config.ts` resolves only SHCW and defaults disabled. Versioned routes are in `apps/passport-web/app/api/v1/channel/`; they use the existing atomic bridge services and public verification resolver without changing legacy routes. `packages/passport-sdk/src/index.ts` exposes typed v1 bridge and verification methods. No migration, SHCW UI, partner credential, CORS/domain, deployment, or production verification work is included.
