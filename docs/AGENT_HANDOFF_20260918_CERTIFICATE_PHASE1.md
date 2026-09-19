# Climate Passport Development Handoff

Date: 2026-09-18

## 1. Handoff Purpose

This is the current execution handoff for the next development agent. Use it together with, in this order:

1. `CLIMATE_PASSPORT_FUNCTIONAL_REQUIREMENTS_V2.md`
2. `DEVELOPMENT_REQUIREMENTS_AND_PLAN_20260918.md`
3. `CURRENT_IMPLEMENTATION_STATUS.md`
4. `CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md`
5. `trackers/CERTIFICATE_MODULE_PENDING_FEATURES_TRACKER.md`

Do not infer completion from page existence, old screenshots, historical trackers or mock-only tests.

## 2. Repository And Working-Tree State

- Working repository: `/Users/rr/Projects_AD/climatepassport`
- Branch/HEAD at handoff: `main` / `f1035c2`
- The working tree contains a large, intentional, uncommitted baseline from multiple development sessions.
- Do not reset, clean, discard, mass-format, commit, push or deploy unless the user explicitly asks.
- Review the current diff before touching a file. Work with existing changes rather than replacing them.
- The OneDrive path shown in some older desktop context is not the active repository used for this handoff.

## 3. Product And Scope Boundary

Climate Passport is the reusable digital foundation. Programme-specific business workflows remain in independently developed programme systems and integrate through scoped contracts.

- CP owns shared identity, Passport ID, authorization, consent, participation records, credentials, QR/verifier, audit, notifications and integration contracts.
- CP must not absorb Future Stewards editorial/inquiry workflows, SHCW annual private operations, Convener membership/contribution operations or future programme-specific rules.
- Summer-school functionality is frozen. Do not change its business behavior, routes, schema or UI during the current certificate work.
- Generic Learning Experience work must not be used as permission to migrate or redesign summer school.

## 4. Completed And Verified In The Current Local Baseline

CP-TODO-218 through CP-TODO-227 are completed only within their explicitly bounded local scope.

- P0 test isolation, Activity object authorization, authoritative check-in, rate-limit identity, privacy-minimized exports and real authentication acceptance are complete locally.
- Certificate artifact authorization/counting, UTF-8 download names, immutable issued snapshots, lifecycle provenance/concurrency and category/template dependency guards are complete locally.
- Persisted Activity check-in issuance rules replace static rule examples. Unsupported Course, Learning Experience, Points and manual-review triggers remain unavailable.
- Core manual issuance, regeneration, application approval and Activity check-in issuance create real `application/pdf` artifacts.
- PDF rendering supports configured background/assets, typography, seal, physical A4 landscape/portrait and digital-card dimensions, Noto Sans SC subset embedding and one unique verification QR per certificate.
- Artifact access remains private. Anonymous QR verification uses minimum disclosure and does not grant artifact download.
- Migrations through `20260918020000_certificate_issuing_rules` are applied to local development and isolated test databases only.

Latest completed verification before this documentation-only handoff:

- Node tests: 350/350 passed.
- API tests: 8 passed, 7 explicit skips for unimplemented placeholder flows, 0 failures.
- Browser tests: 26 passed, 14 explicit data/capability skips, 0 failures.
- TypeScript, lint, production build, Prisma validation and all 30 local migrations passed.
- Browser tests run serially because the suite shares one isolated database and Next development compiler.

These results do not prove production storage, renderer deployment, retention, backup/restore or production migration readiness.

## 5. Current Stop Point

Development stops after CP-TODO-227. CP-TODO-228 was inspected but no schema, migration, API, service, UI or test implementation was started for it.

The existing "batch issuance" is not durable batch processing:

- `CertificateAdminIssue` parses an email list in the browser and posts `emails` to `/api/admin/certificates/issue`.
- The route executes every recipient through `Promise.all` in one request.
- There is no batch record, item state, preflight result, claim/lease, retry state, interruption recovery, batch correlation or batch notification state.
- A browser/request/process interruption can lose progress reporting, and a large batch can overload PDF rendering/storage.
- Existing duplicate checks help normal issuance but are not a complete batch idempotency protocol.

Therefore CP-TODO-228 remains `todo`, not `doing` or `done`.

## 6. Next Work Package: CP-TODO-228

Deliver durable CSV/manual-list and authorized Activity eligible-list certificate batches. The first source integration is Activity only. Do not add Learning Experience, course, points or summer-school sources.

Recommended implementation sequence:

1. Extract the current per-recipient issuance logic from `app/api/admin/certificates/issue/route.ts` into a server service. Preserve single issuance and edit/reissue behavior before adding batches.
2. Add additive Prisma batch and batch-item models with explicit source, status, counts, idempotency key, normalized recipient identity, attempts, error, linked certificate issue, timestamps and creator. Add a new migration; do not rewrite old migrations.
3. Add server-side preflight for deduplication, malformed rows, inactive template/definition, existing issues and Activity-source authorization/eligibility. A client-only CSV check is insufficient.
4. Create batches and items transactionally, then process a small bounded chunk per claim. Do not render up to 200 PDFs concurrently in one request.
5. Use compare-and-set item claiming with an expiring lease or equivalent recoverable state. A retry after interruption must resume pending/failed/stale items.
6. Reconcile the failure window where a certificate was created but the item update did not complete. Retry must link the existing certificate rather than issue another one.
7. Create one in-app notification per newly issued certificate when requested. Retrying a successful item must not duplicate the notification.
8. Add batch progress, per-item result, retry-failed and Activity eligible-list selection to the existing certificate issue page. Preserve responsive behavior and the shared admin shell.
9. Add audit correlation for batch creation, processing, retry and completion, while keeping critical audit recovery work scoped to CP-TODO-230.

Do not add a uniqueness constraint on `(definitionId, userId)` without first auditing existing production-compatible data. Batch idempotency must not assume that such a constraint can be introduced safely.

## 7. CP-TODO-228 Minimum Acceptance

- Duplicate/malformed CSV rows are reported before confirmation and do not create duplicate items.
- Reusing the same idempotency key returns the same batch.
- Two concurrent process/retry calls cannot issue the same item twice.
- Partial failure produces truthful per-item and aggregate states.
- Interrupting after some items complete and resuming does not reissue completed recipients.
- An artifact/render/storage failure remains retryable and does not display success.
- Activity eligible-list selection is server-derived and ADMIN-authorized; arbitrary client-provided eligibility is rejected.
- Activity is the only source adapter enabled in this phase.
- Notification count is exactly one for each newly issued item when notification is enabled, and zero when disabled.
- Existing single issue, reissue, public verification, private artifact download, revoke/restore/regenerate and Activity check-in issuance regressions remain green.
- Real database and browser acceptance are required; mocked route tests alone are insufficient.

## 8. Files To Read First

- `apps/passport-web/app/api/admin/certificates/issue/route.ts`
- `apps/passport-web/components/certificate-admin-prototype.tsx`
- `apps/passport-web/app/[locale]/admin/certificates/issue/page.tsx`
- `apps/passport-web/lib/server/certificate-module.ts`
- `apps/passport-web/lib/server/certificate-pdf-renderer.ts`
- `apps/passport-web/lib/server/certificate-artifact-storage.ts`
- `apps/passport-web/lib/server/activity-checkin-certificate-issuance.ts`
- `prisma/schema.prisma`
- `tests/certificate-issuance-routes.test.mjs`
- `tests/certificate-pdf-renderer.test.mjs`
- `tests/e2e/certificate-artifact-security.spec.ts`

## 9. Verification Commands

Run focused tests during implementation, then the full gates before changing tracker status:

```bash
npm test
npm run test:api
npm run test:e2e
npm run lint
npx tsc -p apps/passport-web/tsconfig.json --noEmit
npm run db:validate
CI=true npm run build
npm run db:migrate:status
git diff --check
```

Use only the isolated test runner for API/browser tests. Do not point tests at shared development or production databases.

## 10. Work After CP-TODO-228

Continue in the accepted plan order:

1. CP-TODO-229: certificate application detail/history/reviewer workflow acceptance.
2. CP-TODO-230: reliable critical audit/recovery and truthful batch/dashboard analytics.
3. CP-TODO-237: eight certificate admin modules, links, prototype-body fidelity and responsive acceptance.
4. Phase 2 and later shared-platform work only after their dependencies pass.

## 11. Execution Addendum (same day, after CP-TODO-228)

CP-TODO-228 is implemented for the bounded local scope and verified; continue from CP-TODO-229.

- Schema/migration: `20260918030000_certificate_batch_issuance` adds `CertificateBatch` + `CertificateBatchItem` (idempotency key, source, counts, normalized recipient, attempts, expiring lease, error, linked issue, creator) and a partial unique index giving each batch item at most one `CERTIFICATE_BATCH` issue. Applied to local dev and isolated test DBs only.
- Refactor: per-recipient issuance extracted from `app/api/admin/certificates/issue/route.ts` into `lib/server/certificate-issuance.ts`; single issue, edit/reissue and the legacy email-list endpoint keep their behavior (legacy path kept for compatibility; the admin UI batch tab no longer uses it).
- Batch service `lib/server/certificate-batch-issuance.ts`: server preflight (malformed/duplicate/existing-issue rows; Activity eligibility derived from COMPLETED/CERTIFIED participations only), transactional create, bounded chunk processing (default 5, max 10 per request), per-item compare-and-set claims with 5-minute leases, reconcile that links an already-created certificate instead of reissuing, exactly-one in-app notification per newly issued item inside the item-success transaction, and batch create/process/retry/completion audit.
- Routes: `POST /api/admin/certificates/batches/preflight`, `GET|POST /api/admin/certificates/batches`, `GET /api/admin/certificates/batches/[id]`, `POST .../process`, `POST .../retry-failed`. All ADMIN-session authorized.
- UI: issue-page batch tab now runs preflight → create batch → polled chunk processing → per-item results with retry-failed; recent batches list supports resuming in-flight batches.
- Verification: `npm test` 366/366; `npm run test:api` 16 pass + 7 explicit placeholder skips; `npm run test:e2e` 27 pass (41 total) + 14 explicit skips, including a browser-driven batch flow (`tests/e2e/certificate-batches.spec.ts`); `npm run lint`, `npx tsc --noEmit`, `npm run db:validate`, `CI=true npm run build`, `npm run db:migrate:status` (31 migrations) and `git diff --check` all pass. Real-DB evidence includes idempotent replay, per-item truthful failure states, retry-failed reclaiming only failed items, server-derived Activity lists rejecting forged client lists, exactly-one/zero notifications, real PDF artifacts and batch audit rows.
- Not done (out of scope here): external email delivery, background workers, non-Activity sources, production storage/renderer/retention deployment.

Production renderer/storage configuration, retention, backup/restore, migration dry-runs and deployment remain release work under CP-TODO-238. Completion of local code must never be described as production deployment.
