# Certificate Module Pending Features Tracker

Last updated: 2026-05-27

## Completed
- Build blocker fixed for rules page Prisma select fields (`title/titleEn`).
- User certificate routes available: `/[locale]/dashboard/certificates` and `/[locale]/dashboard/certificates/[id]`.
- User certificate list now supports search, category filter, and status filter.
- Certificate detail public-profile visibility toggle is persisted through `/api/certificates/[id]/visibility`.
- Public profile credentials now only show issued certificates explicitly marked `publicVisible`.
- Certificate download action now writes Core audit logs.
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

## In Progress
- Admin operation depth for records/issue/templates/categories/applications/rules/audit-logs.
- Certificate lifecycle regression coverage (API-level and end-to-end boundaries).

## Pending
- End-to-end certificate lifecycle tests (issue/verify/download/revoke/restore).
- Rich batch issue workflows and stronger audit UI productization.
- Full rendering/storage lifecycle hardening.
