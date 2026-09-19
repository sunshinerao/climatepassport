# Controlled PROJECT Interest & Application Operations

Status: local implementation and local migration only (2026-09-13). This is not a production deployment claim.

## Scope

This workflow applies exclusively to `Activity.type = PROJECT`. It reuses the bounded `ActivityApplication` record and has no interest-only submission behavior, even though the reserved `allowInterestWithoutApplication` flag exists and defaults to `false`.

Each submitted PROJECT application must have exactly one `ProjectApplicationConsent` using `PROJECT_APPLICATION_CONSENT_V1`. The applicant selects each disclosure field independently: name, email, title, bio, affiliations, and an optional portfolio share-link reference. Portfolio links are accepted only when active, unexpired, and owned by the applicant. The raw share token is never stored in the consent record or exposed to reviewers.

## Access and privacy

- Applicants can submit and withdraw only their own PROJECT applications.
- ADMIN can review any PROJECT application. The exact `organizerUserId` can review its project. EVENT_MANAGER has no fallback PROJECT review access.
- Reviews permit only APPROVED, REJECTED, and WAITLISTED. INTERVIEW and OFFERED are not PROJECT states.
- Reviewer output is field-scoped by consent and omits applicant raw user ID, Passport ID, and all unconsented fields. Applicant lists are not public. `applicantListVisibleToApplicants` defaults to `false` and does not create a public directory.
- Submit, consent capture, withdrawal, review, and reviewer views are audited. In-app notifications are sent only to applicant/owner with safe metadata and no personal data in notification bodies.
- Approval creates an accepted participation only when one does not already exist for the `(activityId, userId)` pair.

## Explicit deferrals

No team applications, jobs, recruitment, candidate search, institution browsing, partner search, matching, AI, public applicant directory, raw portfolio token handling, background jobs, or production migration/deployment are included.
