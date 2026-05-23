# Certificate Module Pending Features Tracker

Last updated: 2026-05-23

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

## In Progress
- Admin operation depth for records/issue/templates/categories/applications/rules/audit-logs.
- Certificate lifecycle regression coverage (API-level and end-to-end boundaries).

## Pending
- End-to-end certificate lifecycle tests (issue/verify/download/revoke/restore).
- Rich batch issue workflows and stronger audit UI productization.
- Full rendering/storage lifecycle hardening.
