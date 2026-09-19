# Certificate Module Pending Features Tracker

Last updated: 2026-09-18

## Current Acceptance Gaps

The completed list records bounded implementation history, not a claim that every current path is accepted. See [the gap audit](../REQUIREMENTS_IMPLEMENTATION_GAP_AUDIT_20260918.md) and [execution plan](../DEVELOPMENT_REQUIREMENTS_AND_PLAN_20260918.md). Authoritative remaining work IDs are in the platform tracker:

- CP-TODO-224: completed 2026-09-18; artifact count persistence, Unicode filenames and authorization regression pass in the isolated real DB/browser suite.
- CP-TODO-225: completed 2026-09-18; immutable printed identity, lifecycle provenance/concurrency and dependency protections pass in the isolated real DB/browser suite.
- CP-TODO-226: completed 2026-09-18; the only enabled trigger is persisted Activity check-in, while unsupported triggers are explicitly unavailable.
- CP-TODO-227: completed 2026-09-18 for the bounded core issuance paths; real PDF, configured assets/layout, embedded Chinese font subsets, private delivery and artifact QR decode tests pass locally. Production storage/renderer deployment and retention remain release gates.
- CP-TODO-228: completed 2026-09-18 for the bounded local scope; durable MANUAL_LIST/CSV/Activity-eligible batches with server preflight, idempotency keys, compare-and-set item claims with expiring leases, failure reconcile, exactly-one in-app notifications and batch audit correlation pass in the isolated real DB suite. External email, background workers and non-Activity sources remain out of scope.
- CP-TODO-229: application detail/history/reviewer acceptance; attachments separately gated.
- CP-TODO-230: reliable critical audit and truthful operational metrics.
- CP-TODO-233/237: consent-based portfolio acceptance and all eight admin modules' strict prototype/mobile verification.

Execute after platform authorization/test-isolation fixes. Preserve summer-school business behavior, including shared-provisioning compatibility; do not refactor it as part of this certificate work.

## Completed
- Build blocker fixed for rules page Prisma select fields (`title/titleEn`).
- CP-TODO-228 durable batch issuance (local scope): additive migration `20260918030000_certificate_batch_issuance` adds `CertificateBatch`/`CertificateBatchItem` with idempotency key, source, counts, normalized recipient, attempts, error and linked issue; a partial unique index makes each batch item own at most one `CERTIFICATE_BATCH` issue. Per-recipient issuance was extracted into `lib/server/certificate-issuance.ts` and is shared by the single-issue route and `lib/server/certificate-batch-issuance.ts` (server preflight, transactional create, bounded chunk processing, compare-and-set claims with 5-minute leases, issue-created/item-not-updated reconcile, exactly-one in-app notification inside the item success transaction, batch create/process/retry/completion audit). Admin API routes live under `/api/admin/certificates/batches` (preflight, list, create, detail, process, retry-failed) and the issue page batch tab now runs preflight → create → polled chunk processing with per-item results. Activity is the only source adapter; eligible means participation COMPLETED/CERTIFIED derived server-side. Evidence: `tests/certificate-batch-issuance.test.mjs` (12), `tests/certificate-issuance-service.test.mjs` (4), `tests/api/certificate-batches-api.test.ts` (8 real-DB tests) and refreshed issuance-route tests.
- User certificate routes available: `/[locale]/dashboard/certificates` and `/[locale]/dashboard/certificates/[id]`.
- User certificate list now supports search, category filter, and status filter.
- Certificate detail public-profile visibility toggle is persisted through `/api/certificates/[id]/visibility`.
- Public portfolio now uses explicit consent and revocable opaque token sharing, with visibility/current-evidence constraints; the former `/profile/[userId]/credentials` lookup returns 404.
- Certificate download counters are persisted only for successfully served attachments; inline/denied/missing responses do not increment and UTF-8 filenames are retained. Critical audit recovery still requires CP-TODO-230.
- Public verification page route available: `/verify/certificate/[code]`.
- Regression tests added for certificate verification serialization and minimum-disclosure mapping (`tests/certificate-verification-serialization.test.mjs`).
- Migration added and locally applied for `CertificateIssue.publicVisible`: `prisma/migrations/20260523001000_certificate_public_visibility`.
- Certificate signer display now comes from template render config `signerName`, and single issue holders are entered explicitly on the admin issue form.
- Manual certificate issue now auto-provisions a Climate Passport user for unknown recipient emails, reuses the Summer School passport-user provisioning path, and auto-fills holder name from an existing Passport profile when the email already exists.
- Editing an issued certificate in the admin issue form now backfills the original certificate number into the read-only certificate number field and edit preview.
- Certificate issue form drafts are now preserved only across locale switches; explicit completion actions such as confirm issue success and cancel edit clear the single-issue form and stored draft.
- Locale-switch draft persistence for certificate issuing now also preserves `editingIssueId` and `editingCertificateNumber`, so edited certificate numbers do not fall back to `CV-{AUTO-GENERATED}` after switching language.
- Confirm issue in single-issue mode now reports both success and failure via popup feedback dialog (including validation and network failures), rather than only inline form text.
- Certificate records action label was refined from `下载（预览/打印）` to `预览/打印` (and English from `Download (Preview/Print)` to `Preview/Print`) without changing download/preview behavior.
- Certificate public verification now uses a unified Core-oriented resolver shared by page and API, with access-level disclosure (`PUBLIC`/`HOLDER`/`STAFF`), policy checks (`verificationMode`, `publicVerifyEnabled`), and full query audit logging for both QR scan and web query flows.
- Public verification UI now supports signed-in identity-aware display and operational counters (verification count, query count, internal verification metadata for privileged viewers).
- Formal end-to-end validation record completed for certificate verification runtime behavior, identity-tiered access, query logging counters, and regression checks (`docs/BUGFIX_CERTIFICATE_VERIFICATION_E2E_VALIDATION_20260525.md`).
- Certificate template image upload controls (background/logo/signature/seal) are now aligned to avatar-style file selection UX with custom button, filename feedback, and existing image preview.
- Phase 1 Certificate Applications code and an additive local migration exist: owner-scoped request/edit/resubmit/withdraw APIs, admin review APIs, append-only application events, and atomic approval/issue provenance, audit, and in-app notification writes. The local migration `20260913020000_certificate_applications_phase1` is applied locally only.
- Bounded Activity QR check-in auto-issuance code and the local-only `20260913030000_activity_checkin_certificate_issuance` migration exist: authoritative unified scanner path only, unconditional eligible rules, durable reservation, reproducible render snapshot, and transactional audit/in-app notification. Legacy Event/direct routes, general rule engine, jobs, email, PDF, object storage, and production deployment remain deferred.
- Private artifact metadata from `20260913040000_certificate_artifact_storage_phase1` now carries real PDF output for bounded core issuance paths while retaining legacy HTML compatibility. Local or generic authenticated HTTP storage and authorized delivery exist. Production durable storage configuration, retention and legacy-inline migration remain deferred.

## In Progress
- Admin operation depth for records/issue/templates/categories/applications/rules/audit-logs.
- Certificate lifecycle regression coverage (API-level and end-to-end boundaries).

## Pending
- End-to-end certificate lifecycle tests (issue/verify/download/revoke/restore).
- Rich batch issue workflows and stronger audit UI productization.
- Full rendering/storage lifecycle hardening.
- Certificate application attachments, external email, background jobs, automated rules, and production deployment.
