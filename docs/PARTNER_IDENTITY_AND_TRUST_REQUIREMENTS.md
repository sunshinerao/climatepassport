# Partner Identity And Trust Requirements

Governing authority: [Climate Passport 最高开发指导纲领](CP_MASTER_DEVELOPMENT_DIRECTIVE.md). This document provides subordinate detail and implementation notes; the master directive prevails in any conflict.

Last updated: 2026-09-22

Status: current product requirements; not an implementation completion claim.

## 1. Authority And Scope

This document records the 2026-09-22 product decisions following review of the 13-page `Climate Passport 数字平台功能需求文档.pdf`. It supplements `CURRENT_PRODUCT_REQUIREMENTS.md` and `CURRENT_ARCHITECTURE_DECISIONS.md`.

Confirmed decisions:

- Blockchain anchoring remains a long-term requirement, outside the current development plan. It is not cancelled and is not a release prerequisite.
- Institution trust and activity trust are separate dimensions. Different trust levels govern eligibility for certificates, points, badges, and other rewards.
- Independent third parties manage their own passwords. With explicit user consent to also register with Climate Passport, CP creates a Passport record; the user sets a separate CP password after proving account ownership.
- Independent partners retain their UI, database responsibilities, and approval workflows. CP receives relevant confirmed facts and supplies scoped Core services without requiring a redirect into CP for partner business operations.

The safeguards below define the proposed implementation requirements for these decisions. Exact tier names, reward amounts, token lifetimes, and retention periods remain open configuration decisions, not approved numerical policy.

## 2. Ownership And Open API Boundary

- CP-native projects may use CP's complete application, review, participation, and completion workflows.
- SHCW remains a Channel Shell; its existing Core/Shell boundary is unchanged.
- Independent partner systems own their business workflows and final approval decisions. They need logically owned persistent business data and administration, which may be provided by an existing CMS, LMS, SaaS, or backend service rather than a bespoke physical database.
- CP stores accepted identity associations, confirmed participation, check-in results, learning/practice outcomes, evidence provenance, and CP reward decisions. Partner internal review notes and unrelated application materials are not copied by default.
- Every CP functional module must plan authorized API access; this does not make every record public or every admin operation available to partners.
- Open API covers record ingestion/correction, CP check-in and credential services, authorized reads, processing receipts, and notifications. CP wallets require reserve/confirm/release or equivalent transactional controls; they cannot rely solely on after-the-fact spending reports.
- Public activity/news discovery feeds are separate from private person records. Sync only authorized public metadata with source links and withdrawal/update handling. Content publication or page views do not establish verified participation.

## 3. Consent-Based Passport Provisioning

### 3.1 Partner Experience

1. The person registers in the partner's own interface using the partner's own password.
2. A separate, unchecked-by-default option offers simultaneous CP registration. It identifies CP, the data sent, the purpose, and the applicable terms/privacy notices. Marketing permission and public-profile publication are separate choices.
3. If the person declines, do not create an identifiable CP account or upload their personal participation history through this opt-in flow. They can continue the partner's service independently.
4. With consent, the partner backend submits only necessary identity attributes, its stable external person reference, and consent evidence. It never sends the partner password or password hash.
5. CP checks partner permissions and processes an idempotent provisioning request. For a new identity, it creates a non-public, unclaimed Passport record and allocates the stable Passport ID under `PASSPORT_ID_AND_QR_SPEC.md`; it does not create a usable password, authenticated session, or verified-person claim.
6. CP sends ownership verification/claim instructions through a CP-controlled channel. Partner registration and business operations do not wait for the user to visit CP.
7. The partner receives a scoped request/person reference and allowed processing status, not a CP session, recovery token, or unrelated profile. An unverified contact match must not reveal an existing CP account or its Passport ID.

Consent evidence includes partner, external person reference, affirmative action, timestamp, terms/privacy versions, purpose, and permitted fields. Retain only necessary evidence; a bare untraceable `consent: true` is insufficient. CP retains the provenance needed to audit the partner assertion.

Provisioned Passport creation, verified contact ownership, authenticated account access, and an institution's trust assessment are distinct states. They must not be collapsed into a single `ACTIVE` flag without an explicit state design.

### 3.2 Existing Accounts And Duplicate Prevention

- Once a verified partner-person mapping exists, repeat requests resolve to the same identity; retries never allocate another Passport ID or repeat registration rewards.
- A matching email is a linkage candidate, not authorization to access, merge, overwrite, or attach partner records to an existing CP account.
- Hold unresolved linkage and partner records in a scoped pending state until CP verifies ownership and the user's authorization to link. Do not create another activated identity for the same contact.
- Concurrent provisioning and claim operations must reconcile atomically to one canonical identity. Explicit merge procedures preserve provenance and historical references, without changing an established user's Passport ID or recycling identifiers.
- Existing passwords, MFA, profile fields, roles, and sessions must remain unchanged by partner provisioning or consent alone.
- A partner's contact-verification assertion is evidence, not automatic permission to reset an existing CP password. First release uses CP-controlled verification; any future federation exception needs separate security review.
- Claims must show the source partner and allow the user to reject an unexpected association. Provisioning must not establish attacker-controlled alternative login methods or lasting partner access that survives a legitimate claim.

### 3.3 First Access And Password Recovery

- Present an explicit first-access action such as "Activate Passport / Set Password" instead of requiring a new user to guess that "Forgot Password" is the activation path.
- Require CP-controlled proof of the contact's ownership before setting a password, activating login, or accessing private records. After successful setup, use normal login rather than treating a provisioning receipt as a session.
- An existing password uses the reset flow; an unset password uses the claim/setup flow. They may share secure primitives, but their purposes, state transitions, and token permissions must remain separate. Never recover or send an old password.
- Tokens/codes must be random, expire, be single-use, and be securely stored. Bind them to the account/contact and action. Validate state and consume the credential atomically with the change; concurrent replay must not succeed.
- Rate-limit requests and attempts, avoid account enumeration, redact secrets from logs, notify the owner of credential changes, and invalidate applicable sessions/recovery credentials. Recovery must not bypass suspension, MFA, or administrative restrictions.
- Changing or resetting either system's password does not change the other system's password. The partner cannot set, retrieve, or reset the CP password through its integration credentials.
- Setup may occur when the user later visits CP. This optional CP account access is not a redirect prerequisite for completing partner registration, approval, or check-in.
- Private source records can wait for verified linkage/claim; pending data must not be published or treated as identity-verified rewards. Limit unclaimed-data retention and provide cancellation, consent withdrawal, and source unlinking. Historical retention/deletion needs a separate approved policy; it is not silently equated with deleting audit history.

Security reference: [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html). Its single-use, expiry, anti-enumeration, and recovery safeguards inform the requirements above; they do not establish that existing CP endpoints already comply.

## 4. Trust Dimensions

### 4.1 Institution Trust

Record the institution, assessment scope, supporting evidence, assessor, assessment time, effective dates, review date, status, and version. Assess identity validation, source reliability, evidence controls, and operating history, not institutional fame or commercial sponsorship.

Institution trust is scoped: an institution trusted to submit attendance is not automatically entitled to issue competence certificates or submit results for other institutions. API authorization, issuer authorization, and trust level are separate gates.

### 4.2 Activity Trust

Assess each activity/program independently: organizer authorization, learning/action standards, participation measurement, verifier controls, completion criteria, evidence quality, and auditability. Associate the decision with the relevant event/program/edition, validity period, and rule version.

A highly trusted institution does not automatically give every activity the highest tier. Institution identity verification does not prove academic accreditation or a participant's competence.

### 4.3 Individual Evidence And Result

Retain the source record, person mapping, activity, time of occurrence and receipt, role, attendance/completion facts, evidence references, verification method, corrections, and CP assessment. A trusted event does not prove that every registered person attended or completed it.

Accepted source facts, evidence review status, reward eligibility, and awarded rewards must remain distinguishable. Lack of a reward must not erase the original action record.

## 5. Trust-Based Rewards

Reward eligibility depends jointly on institution trust, activity trust, person linkage, evidence sufficiency, issuer permission, and a versioned reward policy. Do not reduce this to a universal multiplier or allow a partner to assign its own authoritative level or points amount.

Illustrative policy outcomes, not fixed tier names or approved reward amounts:

| Evidence situation | Possible result, only if the configured policy permits |
| --- | --- |
| Source assertion awaiting validation | Private pending record; no automatic verified certificate, points, or badge |
| Verified institution and confirmed registration only | Registration record; not attendance or completion certification |
| Validated activity and verified participation | Participation certificate/badge and participation points within configured limits |
| Assessed learning/practice outcome with sufficient evidence | Completion or competence credential, corresponding badge and points |

- Configure per institution/activity/program and reward type: minimum requirements, evidence checks, certificate category, badge definition, points amount/caps, repeat limits, review requirements, and effective dates.
- More trust permits a different eligible reward set; it does not guarantee more points for an unrelated action or automatically upgrade a participation certificate to a competence certificate.
- Freeze the trust assessments, evidence versions, rule version, decision reason, and source references at award time. Explain the awarded outcome to the user without exposing private reviewer notes.
- Apply rule changes prospectively by default. Historical reassessment is an explicit audited process; do not silently rewrite earlier awards or balances.
- Suspected fraud or suspension freezes affected new automatic awards pending review. An institution downgrade does not automatically revoke every historical credential.
- Confirmed invalid evidence triggers an audited impact review across dependent certificates, badges, and points. Revoke affected credentials and record compensating ledger entries; do not delete the original reward transaction. Spent-point shortfalls need an explicit recovery policy.
- Manual exceptions require appropriate authority, justification, and audit. Partners may supply evidence or appeal decisions, but cannot bypass CP policy through ingestion fields.

## 6. User, Admin, And API Requirements

### User Surfaces

- Partner registration consent and CP setup notification; later CP activation/setup and ordinary password reset.
- Linked-source management, unclaimed/pending linkage state, consent withdrawal, and unexpected-link rejection.
- Passport timeline and reward details showing source institution/activity, applicable verified facts, reward status, and correction/revocation notices. Trust descriptions must not imply accreditation beyond the recorded scope.

### Admin Surfaces

- Institution assessment register with scoped permissions, evidence, expiry/review dates, suspension, and history.
- Activity assessment register with independent criteria, verification method, evidence requirements, and review queue.
- Reward policy editor with versioning, preview/simulation, publication approval, effective dates, caps, and traceable manual exceptions.
- Partner applications and permissions, consent/provisioning/linkage status, failed requests, retries, suspicious claims, and privacy requests. No password or token inspection screens.
- Cross-module reward-impact review and reconciliation for corrected sources, institution suspensions, revoked credentials, and point compensation.

### API Contracts To Implement

- Authenticated, scoped provisioning/consent submission, claim/link status, and unlink/withdrawal requests. CP-controlled credential setup is not a partner admin privilege.
- Confirmed participation and evidence submission/correction/revocation, CP check-in, and authorized receipt/result reads.
- Authorized reward eligibility/results and credential status queries; detailed internal risk assessments are not public APIs.
- Idempotency, external-record mapping, tenant/source isolation, replay protection, rate limits, audit, retryable processing receipts, and authenticated webhooks. Derive the caller's partner identity from credentials, not a caller-supplied identity field.
- Durable acceptance before acknowledgement, conflict/version handling for out-of-order events, and reconciliation prevent duplicate awards or lost corrections. Existing internal browser-session routes are not automatically approved partner APIs.

## 7. Acceptance Scenarios

1. Declining the optional checkbox creates no CP identity or personal record through that flow and does not block partner registration.
2. Consent produces one private, unclaimed Passport; repeated/concurrent requests create no duplicate identity or registration reward, and transfer no password/hash.
3. Matching an existing email neither changes credentials nor links or exposes private records before verified authorization.
4. Valid CP claim proof enables first password setup without changing the Passport ID; expired, replayed, wrong-purpose, wrong-contact, or concurrently consumed tokens fail.
5. Suspended accounts and MFA controls cannot be bypassed through claim/reset. Unexpected associations can be rejected; untrusted pre-claim access does not survive claim.
6. A trusted institution's unassessed activity does not inherit maximum rewards, and registration alone never produces completion certification.
7. Identical valid facts under different approved trust policies produce the configured eligible rewards with explainable decision snapshots.
8. Duplicate delivery grants rewards once; unauthorized partner writes and self-assigned trust/reward values are rejected.
9. Corrections/revocations trigger traceable downstream review and compensating records. Historical awards do not silently change when a new policy is published.
10. All current flows work without blockchain, blockchain wallets, gas fees, smart contracts, or offline QR verification. The CP off-chain points wallet remains in scope.

## 8. Deferred Scope And Open Decisions

Blockchain anchoring is retained only as a long-term requirement. Do not schedule chain selection, smart contracts, blockchain-wallet integration, anchoring jobs, or chain-based verification in the current development plan. This deferral does not remove CP's off-chain points wallet or credential collection. Do not claim "Blockchain Verified" in current UI. Existing opaque QR/server-validation decisions remain unchanged.

Before implementation, resolve:

- Institution/activity tier names, assessment criteria, authorized assessors, review cadence, and appeals process.
- Reward mappings, amounts/caps, issuer eligibility, and exceptional historical reassessment/recovery policies.
- First-release verified contact channel, token lifetimes, claim-state transitions, and handling of contact changes or inaccessible contacts.
- Unclaimed-record retention, consent withdrawal/deletion consequences, and per-partner permitted data fields.
- Pilot partner and identity-linkage acceptance tests, including existing-user and cross-partner races.

## 9. Implementation Baseline And Change Record

2026-09-22: documentation-only addition. Institution/activity trust-based reward policy and partner opt-in provisioning are requirements, not shipped features.

Read-only inspection found existing email registration, verification, and reset helpers. `apps/passport-web/app/api/auth/reset-password/route.ts` rejects non-`ACTIVE` accounts. `apps/passport-web/app/api/auth/register/route.ts` handles a `PENDING` user through ordinary registration, which is not evidence of a verified partner claim flow. Neither endpoint should be declared suitable for this integration without explicit state, ownership, and concurrency tests. No business code or schema was changed for this decision.

The source PDF was reviewed in the preceding analysis; it has not been copied into this repository. This file captures only the confirmed scope changes and related requirements, not a full PDF-to-implementation audit.
