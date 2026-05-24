# Certificate Module Product Requirements

Last updated: 2026-05-23

## 1. Module Positioning

The Certificate module is the Climate Passport capability asset and trusted record system. It is not a simple PDF download page.

Certificates, badges, points, and capability records can be generated from verified Climate Passport activity, including:

- course completion, such as FSA Credential, GCA courses, and IFRS sustainability standards courses;
- event participation, such as Shanghai Climate Week forums, closed-door meetings, and youth assemblies;
- Learning Experience programs, such as summer school, study tours, challenges, visits, dialogues, and practice projects;
- role contributions, such as speaker, moderator, mentor, volunteer, organizer, and delegate;
- capability certification, such as climate literacy, sustainable finance, ESG reporting, future food, and water security;
- points, achievements, and milestone triggers, such as level badges and milestone certificates.

The module must present certificates as verifiable digital credentials and long-term Passport assets, not static images.

## 2. Product Principles

- Certificate Hub is a Core module owned by Climate Passport.
- Channel shells must not issue, revoke, verify, or store certificate lifecycle state outside Core rules.
- Each certificate must link to a Passport identity.
- A certificate may link to learning experiences, event participation, roles, points, achievements, milestones, and public profiles.
- Public verification must verify the credential, not expose private user data.
- User-facing pages should feel trusted, international, and institutional.
- Admin pages should be dense, operational, clear, and efficient for batch management.
- Blockchain wording must not appear unless an implemented blockchain verification mechanism exists.

## 3. User-Facing Pages

### 3.1 My Certificates

Route: `/dashboard/certificates`

Purpose: the authenticated user's certificate center.

Required content:

- total certificates;
- verified certificates count;
- recent certificates;
- category filters;
- status filters;
- certificate search;
- certificate card list;
- download entry;
- share entry;
- verification entry.

Certificate card fields:

- certificate name;
- certificate type;
- issuing organization;
- issue date;
- related program, activity, course, or role;
- certificate number;
- status: issued, pending review, expired, revoked, draft;
- public visibility state;
- QR verification support state;
- detail action.

The top area should include a Credential Passport Overview that communicates the user's sustainable capability growth path.

### 3.2 Certificate Detail

Route: `/dashboard/certificates/[id]`

Purpose: show the complete trusted identity of one credential.

Required content:

- certificate preview image or rendered certificate;
- certificate name;
- holder display name;
- certificate number;
- issue date;
- issuing organization;
- related project;
- related event;
- capability tags;
- certificate description;
- signature and seal area;
- QR verification area;
- download PDF action;
- copy verification link action;
- share actions for LinkedIn, WeChat, and email;
- public profile visibility toggle.

The page must present the credential as a digital credential with identity, provenance, and verification metadata, not as a plain image.

### 3.3 Public Certificate Verification

Route: `/verify/certificate/[code]`

Future domain: `verify.climatepassport.org`

Purpose: public, no-login certificate verification.

Required valid-state content:

- verification result: valid, invalid, revoked, expired;
- certificate name;
- holder display name as printed;
- masked Passport ID when useful;
- issuing organization;
- issue date;
- expiry date if applicable;
- certificate number;
- related program, activity, course, or role;
- verification timestamp;
- Climate Passport trusted verification mark.

Invalid-state content:

- certificate not found;
- certificate revoked;
- certificate expired;
- invalid verification link.

Forbidden public fields:

- email;
- phone;
- government ID;
- date of birth;
- application materials;
- internal user ID;
- admin notes;
- private Passport records;
- full private user profile.

### 3.4 Public Profile Credentials

Route: `/profile/[userId]/credentials`

Purpose: user-controlled public credential display.

Supported use cases:

- public display of green capability;
- project application proof;
- employer or institution review of capability records;
- school, mentor, or partner institution review of participation records.

Required content:

- featured credentials;
- capability tags;
- learning paths;
- project participation records;
- verification entry for each public credential.

Only user-approved credentials should be public.

## 4. Admin Pages

Certificate Hub admin pages are module-internal pages. They should be exposed as the Certificate Hub secondary menu inside the shared admin shell, not flattened into the global admin primary menu.

Required Certificate Hub secondary menu order:

1. Certificate overview: `/admin/certificates`
2. Certificate records: `/admin/certificates/records`
3. Issue certificates: `/admin/certificates/issue`
4. Application review: `/admin/certificates/applications`
5. Category management: `/admin/certificates/categories`
6. Template management: `/admin/certificates/templates`
7. Automatic issuing rules: `/admin/certificates/rules`
8. Verification and audit logs: `/admin/certificates/audit-logs`

### 4.1 Certificate Admin Dashboard

Route: `/admin/certificates`

Required content:

- total certificates;
- certificates issued this month;
- pending review certificates;
- issued certificates;
- revoked certificates;
- certificate template count;
- recent issue records;
- abnormal verification records;
- popular certificate types;
- most-linked events, courses, or programs.

Purpose: give administrators a fast operational overview of certificate system health.

### 4.2 Category Management

Route: `/admin/certificates/categories`

Example categories:

- Course Certificate;
- Event Attendance Certificate;
- Speaker Certificate;
- Moderator Certificate;
- Volunteer Certificate;
- Mentor Certificate;
- Learning Experience Certificate;
- Achievement Badge;
- Milestone Credential;
- Climate Action Record.

Category fields:

- Chinese name;
- English name;
- description;
- icon;
- default color;
- active state;
- auto-issue allowed;
- user application allowed;
- PDF download supported;
- public verification supported.

### 4.3 Template Management

Routes:

- `/admin/certificates/templates`
- `/admin/certificates/templates/[id]`

Required capabilities:

- create template;
- edit template;
- duplicate template;
- enable or disable template;
- preview template;
- set default template;
- upload certificate background;
- configure text fields;
- configure signatures;
- configure seals;
- configure QR position;
- configure certificate number format;
- configure page size, including A4 landscape, A4 portrait, square badge, and digital card;
- configure language version, including Chinese, English, and bilingual.

Template variables:

- user name;
- English user name;
- certificate name;
- program name;
- event name;
- course name;
- completion date;
- issue date;
- certificate number;
- issuing organization;
- role;
- learning hours;
- capability tags;
- signer;
- institution name.

The first implementation may use a configuration form plus certificate preview. A complex visual editor is not required for the first phase.

### 4.4 Certificate Issuance

Route: `/admin/certificates/issue`

Issue methods:

- single-user issue;
- batch user issue;
- issue from event registration or attendance list;
- issue from course completion records;
- issue from Learning Experience completion records;
- automatic issue from points or achievement rules.

Issue fields:

- certificate template;
- certificate category;
- related project, event, course, or role;
- user or user list;
- certificate name;
- role;
- issue date;
- expiry date;
- generated certificate number;
- preview;
- confirmation.

Batch issue support:

- CSV upload;
- select from event registration list;
- select from course completion list;
- select from Learning Experience admitted or completed list;
- batch preview;
- batch generation;
- batch user notification.

### 4.5 Certificate Application Review

Route: `/admin/certificates/applications`

Purpose: review user-initiated certificate applications for credentials such as volunteer proof, project completion proof, or event participation proof.

List fields:

- applicant;
- requested certificate type;
- related project;
- submitted at;
- application statement;
- attachments;
- status: pending, approved, rejected, needs more material;
- reviewer;
- reviewed at.

Detail actions:

- view application;
- view user's Climate Passport summary;
- view related participation records;
- view uploaded materials;
- add admin note;
- approve and issue;
- reject;
- request more material.

### 4.6 Issuing Rules

Route: `/admin/certificates/rules`

Rule examples:

- issue course certificate after course completion;
- issue attendance certificate after event check-in;
- issue speaker certificate after a speaker completes an event role;
- issue project completion certificate after all summer school modules are completed;
- issue Level 1 Climate Action Badge after 1000 points;
- issue Milestone Credential after completing five projects.

Rule fields:

- rule name;
- trigger source: course, event, Learning Experience, points, achievement, manual review;
- trigger condition;
- linked template;
- issue timing;
- admin confirmation requirement;
- automatic user notification;
- download permission;
- public display default.

### 4.7 Certificate Records

Route: `/admin/certificates/records`

List fields:

- certificate number;
- certificate name;
- holder;
- issue date;
- issue source;
- status;
- issuer;
- verification count;
- actions.

Actions:

- view;
- download;
- regenerate;
- revoke;
- restore;
- send notification;
- copy verification link;
- view logs.

### 4.8 Verification And Audit Logs

Route: `/admin/certificates/audit-logs`

Required log types:

- certificate verification time;
- verification source;
- verification result;
- IP or region overview where available;
- certificate download events;
- admin operation records;
- certificate revocation records;
- template modification records;
- batch issue records.

This page should reinforce trust, compliance, and operational traceability.

## 5. Important Workflows

### 5.1 Course Completion Certificate

1. User completes a GCA, FSA-related, or IFRS-related course.
2. The system receives completion state.
3. Issuing rule generates the course certificate.
4. User sees the credential in My Certificates.
5. User downloads the PDF or shares a verification link.
6. The certificate becomes part of the user's Climate Passport capability profile.

### 5.2 Event Attendance Certificate

1. User registers for an event.
2. User checks in onsite.
3. Successful check-in triggers certificate issue.
4. Certificate links to the event.
5. Certificate displays event name, date, location, and role.
6. User keeps the certificate as a sustainable participation record.

### 5.3 Role Contribution Certificate

1. Admin selects people from an event speaker, moderator, mentor, volunteer, or organizer list.
2. Admin selects the matching role certificate template.
3. Admin fills event and role information.
4. System generates certificates in batch.
5. Users are notified.
6. Users can display the certificate in their public profile.

### 5.4 Learning Experience Completion Certificate

1. Student completes application, admission, participation, and completion workflow.
2. Admin confirms program completion.
3. System generates the Learning Experience certificate.
4. Certificate links to the program.
5. Certificate may show learning theme, mentor, project outcome, and capability tags.
6. Certificate becomes an important Climate Passport milestone.

### 5.5 Third-Party Verification

1. User shares a certificate link with a school, employer, or partner institution.
2. Third party opens the public verification page.
3. Page shows the certificate is valid, revoked, expired, invalid, or not found.
4. Page displays issuing organization, certificate number, and source context.
5. Page does not expose private user data.

## 6. Data And Service Requirements

The existing CertificateCategory, CertificateTemplate, CertificateDefinition, CertificateIssue, and CertificateVerification models are the current base.

The next implementation should evaluate whether additional fields or models are required for:

- template layout JSON;
- template background asset URL;
- rendered file URL and storage metadata;
- preview image URL;
- public visibility setting;
- share settings;
- certificate application records;
- issuing rule records;
- batch issue jobs;
- audit log specialization beyond CoreAuditLog;
- download event details;
- template versioning.

Certificate service rules should move toward `packages/passport-core` where possible, including:

- certificate number generation;
- verification code generation;
- issue eligibility;
- revoke and restore rules;
- download authorization;
- public disclosure serialization;
- points, achievements, and milestones writeback rules.

## 7. Development Plan

### Phase 1: Productize The Core Certificate Experience

Goal: make certificates visible, verifiable, downloadable, and administrable.

Deliverables:

1. Finalize this PRD and align tracker/status docs.
2. Implement `/dashboard/certificates`.
3. Implement `/dashboard/certificates/[id]`.
4. Implement `/verify/certificate/[code]` as a public UI page backed by the existing verification API.
5. Implement `/admin/certificates/records`.
6. Implement `/admin/certificates/issue` as the first operational issue UI.
7. Implement `/admin/certificates/templates` with configuration form and preview placeholder.
8. Implement certificate download and verification link actions in user UI.
9. Add focused regression tests for public verification, owner download, admin issue, and revoked certificate handling.

### Phase 2: Template Rendering And Storage

Goal: generate real certificate files and previews.

Deliverables:

1. Define template layout JSON schema.
2. Add storage strategy for rendered PDF/image files.
3. Add certificate render service.
4. Add preview generation.
5. Add background/signature/seal/QR placement configuration.
6. Add certificate number format configuration.
7. Add multilingual template support.
8. Add regeneration action with audit logging.

### Phase 3: Rules, Applications, And Batch Operations

Goal: reduce manual work and support real operations.

Deliverables:

1. Implement `/admin/certificates/categories`.
2. Implement `/admin/certificates/applications`.
3. Implement `/admin/certificates/rules`.
4. Implement automatic issue rules for course, event check-in, Learning Experience completion, role assignment, points, achievements, and milestones.
5. Implement batch issue from CSV, event attendance, course completion, and Learning Experience completion lists.
6. Implement user notifications after issue.
7. Implement approve/reject/request-more-material flow for user certificate applications.

### Phase 4: Public Profile And Trust Operations

Goal: turn certificates into public capability assets and traceable trust records.

Deliverables:

1. Implement `/profile/[userId]/credentials`.
2. Add user-controlled public visibility settings.
3. Implement `/admin/certificates/audit-logs`.
4. Add download event logging.
5. Add verification analytics and abnormal verification surfacing.
6. Add restore flow with proper authorization and audit trail.
7. Add stronger compliance copy and operational dashboards.

## 8. First Implementation Scope

The next coding batch should focus on Phase 1:

- user certificate list;
- user certificate detail;
- public verification UI page;
- admin certificate records list;
- admin certificate issue UI;
- admin template management skeleton;
- tests around certificate issue, verification, download, and revoke states.

Do not build a complex visual certificate editor in the first batch. Use a form-driven template configuration and preview region first.
