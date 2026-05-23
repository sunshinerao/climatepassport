# Passport ID And QR Code Specification

Last updated: 2026-05-23

Status: Current product decision plus implementation design draft.

## 1. Goals

Climate Passport ID and QR Code must support long-term global identity without leaking registration order, total user count, issue year, country, source channel, or personal information.

The same Climate Passport identity must be recognizable across events, institutions, countries, and channel shells.

## 2. Passport ID Design Principles

- Globally unique.
- Long-term stable.
- Non-predictable.
- Human-displayable.
- Safe to print on certificates, cards, and account pages.
- Not tied to one event, channel, institution, country, or year.
- Not reversible to user personal data.
- Not usable to infer registration sequence, user count, issue date, or source channel.

## 3. Passport ID Format

Final public format:

```txt
XXXXXXX-XXXXXX
```

Rules:

- Prefix: none.
- Body length: 13 random characters, displayed as 7 characters, hyphen, 6 characters.
- Alphabet: uppercase Crockford Base32 characters, excluding ambiguous characters such as `I`, `L`, `O`, and `U`.
- Source: random, non-sequential generation.
- Collision handling: check uniqueness before write and retry on collision.
- Public use: stable public-facing identifier.
- Internal ID: database primary keys remain UUID/CUID and must not be exposed as Passport ID.
- Encoded meaning: none. Do not encode user type, region, year, event, channel, registration order, or database identity.

Example shape:

```txt
K7M9QF2-T8N4PZ
```

## 4. Required ID Format Properties

The final implementation must use:

- No prefix.
- Thirteen random public characters.
- Collision check at write time.
- Uppercase Crockford Base32 alphabet excluding ambiguous characters.
- Stable canonical form for storage and display.
- Separate internal database primary key and public Passport ID.

The current code uses a random readable format similar to `XXXXXXX-XXXXXX`. Implementation should align the character alphabet exactly with this spec.

## 5. Anti-Patterns

Do not use:

```txt
CP-2026-000001
CP-000001
SHCW-2026-001
```

Do not include:

- year
- event name
- channel name such as SHCW
- country code unless a future privacy review explicitly approves it
- plain sequence number
- incrementing suffix
- encoded user count
- encoded registration order
- raw database ID
- email, phone, name, or personal profile fields

## 6. QR Strategy

Opaque tokens are the default QR strategy.

QR codes must not contain:

- personal data;
- raw JSON payloads;
- email;
- phone number;
- internal database IDs;
- raw user IDs;
- raw certificate issue IDs;
- raw event registration IDs.

Do not rely on client-side QR contents as the source of truth. The server must always validate the token and return only the allowed view.

Offline QR authentication is not required at this stage.

## 7. QR Types

Climate Passport must support at least four QR types:

1. Identity QR
2. Event Check-in QR
3. Certificate Verification QR
4. Invitation / Special Pass QR

Each QR type must have a typed payload, independent expiry rules, and independent verification rules.

## 8. Opaque Token Structure Recommendation

The default QR payload should be an opaque token or public verification URL carrying an opaque token. Server-side token records or resolvers hold the trusted context.

Recommended server-side logical fields:

```json
{
  "v": 1,
  "typ": "identity|event_checkin|certificate_verification|invitation_special_pass",
  "iss": "climate-passport-core",
  "aud": "climate-passport",
  "sub": "opaque-subject-reference",
  "jti": "unique-token-id",
  "iat": 1779465600,
  "nbf": 1779465600,
  "exp": 1779469200,
  "ctx": {
    "eventRef": "optional-server-side-event-reference",
    "certificateRef": "optional-server-side-certificate-reference",
    "passRef": "optional-server-side-pass-reference",
    "scope": ["optional", "allowed", "actions"]
  }
}
```

The final serialized QR may be:

- an opaque token ID that Core resolves server-side;
- a public verification URL that contains only an opaque verification code;
- a signed opaque token when tamper resistance is needed.

The QR should not rely on a plain URL as the trusted payload. If a URL is needed for camera compatibility, the URL should only transport an opaque token or verification code.

## 9. Signing And Encryption Principles

### Signing

Use signing when the verifier or verification API must confirm:

- issuer authenticity;
- payload integrity;
- token type;
- issued time and expiry;
- context binding.

### Encryption

Use encryption when the payload includes sensitive or business-sensitive references that should not be readable by a scanner or third-party camera app.

### Opaque Token Mode

Use opaque token mode by default because:

- payload must be revocable immediately;
- privacy risk is high;
- short-lived server lookup is acceptable;
- online verification is required.

Event check-in QR should use short-lived opaque tokens. Signature is recommended for tamper resistance, but server validation remains the source of truth.

### Key Management

- Keys must be owned by Climate Passport Core.
- Keys must support rotation.
- Payloads must include version and key ID when using signed/encrypted compact tokens.
- Old keys may remain verify-only during a grace period.
- Secrets must not be embedded in channel shells.

## 10. Verification Flow

### Common Flow

1. Scanner sends QR payload to Climate Passport Core verification endpoint.
2. Core identifies QR type and payload version.
3. Core validates opaque token lookup and any signature/encryption wrapper where used.
4. Core validates expiry, audience, issuer, token ID, revocation, and context.
5. Core loads the relevant subject and authorization rules.
6. Core evaluates verifier permission and event/certificate/pass-specific rules.
7. Core returns only the minimum result needed by the caller.
8. Core writes verification or check-in logs.

### Identity QR

- Confirms the user maps to a valid Climate Passport identity.
- Should not expose personal data unless the authenticated viewer has permission.
- May return display-safe identity status and Passport ID.
- May use a public profile URL or controlled token.
- Must respect user privacy settings.

### Event Check-in QR

- Confirms valid event context.
- Uses a short-lived opaque token.
- Confirms registration/approval status.
- Confirms verifier has access to that event.
- Writes attendance/check-in confirmation once rules pass.
- Requires expiration.
- Requires audit log.
- Signature is recommended for tamper resistance.
- Must handle already checked-in, not registered, not approved, expired, revoked, and wrong-event states.

### Certificate Verification QR

- Uses a public verification URL with an opaque verification code.
- Is long-lived.
- Must be revocable server-side.
- Confirms certificate issue exists.
- Confirms certificate is issued and not revoked.
- Returns public verification facts only.
- Writes verification log.

### Invitation / Special Pass QR

- Confirms invitation or pass exists.
- Confirms status and validity window.
- Confirms verifier permission and entry rules.
- Writes verification or entry log.

## 11. Public Certificate Verification Disclosure

The public verification page at `verify.climatepassport.org` follows a minimum necessary disclosure principle.

It may show:

- verification status;
- certificate title;
- holder display name as printed on the credential;
- masked Passport ID;
- issuing organization;
- issue date;
- expiry date if applicable;
- credential type;
- related program/event;
- certificate number;
- verification timestamp.

It must not show:

- email;
- phone number;
- government ID;
- date of birth;
- application materials;
- internal user ID;
- admin notes;
- full user profile;
- private Passport records.

The verification page verifies the credential. It must not expose the person.

## 12. Rotation And Expiry Rules

Passport QR:

- May use a public profile URL or controlled token.
- Must respect user privacy settings.
- Can be long-lived only when disclosure is controlled and revocable.
- Should support manual rotation from user account security settings.
- Should rotate after suspected exposure.

Event Check-in QR:

- Must be short-lived or event-window-bound.
- Must bind to event context.
- Requires server-side validation.
- Requires expiration.
- Requires audit log.
- Should be invalid after event close plus configured grace period.

Certificate Verification QR:

- Can be long-lived.
- Must support revocation checks.
- Must resolve through `verify.climatepassport.org` or Core verification API with an opaque verification code.

Invitation / Special Pass QR:

- Must have explicit validity window.
- Must support single-use or limited-use modes when required.
- Must support revocation.

## 13. Privacy And Security Requirements

- No cleartext name, email, phone, document number, internal database ID, raw JSON payload, or personal profile fields in QR.
- No registration sequence or user count in Passport ID.
- No channel-specific public ID for Core identity.
- Do not trust channel shell-decoded QR contents.
- Core must be the authority for decode and verification.
- Verification responses must be role- and context-scoped.
- Logs must record verifier, subject reference, QR type, result, timestamp, channel, and metadata needed for audit.
- Failed scans must be logged with abuse controls where appropriate.
- Offline QR authentication is out of scope for now.

## 14. API Surface Draft

Final routes may move to `apps/passport-api`, but the capability should be:

- `POST /api/qr/issue`
- `POST /api/qr/decode`
- `POST /api/verifier/check-in`
- `POST /api/verifier/verify`
- `GET /api/certificates/:verificationCode/verify`
- `POST /api/verifier/invitations/verify`
- `POST /api/verifier/special-passes/verify`

## 15. Open Questions

1. Exact signing standard and key storage provider for signed opaque event tokens.
2. Rate limits for QR decode and verifier endpoints.
3. Revocation model details for long-lived Passport QR and certificate verification codes.
4. Exact URL pattern under `verify.climatepassport.org`.
