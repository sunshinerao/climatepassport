# Channel Shell Integration Specification

Last updated: 2026-05-23

## 1. Purpose

This spec defines how SHCW and future partner channel shells integrate with Climate Passport Core without duplicating Core platform capabilities.

Climate Passport is the Core Platform.

SHCW is a Channel Shell.

## 2. Channel Shell Responsibilities

SHCW owns:

- CMS content
- news
- agenda display
- event pages
- speakers presentation
- media center
- partner display
- SHCW branding

Future partner shells may own equivalent channel-specific content, layout, navigation, and branding.

## 3. Climate Passport Core Responsibilities

Climate Passport Core owns:

- identity
- account
- login/register
- Climate Passport ID
- event registration
- learning experience application
- certificate
- points
- achievements
- milestones
- QR
- verifier
- check-in
- verification
- participation record

## 4. Integration Modes

### API Mode

The shell calls Core APIs for authenticated or public operations.

Use for:

- event registration
- check-in validation
- certificate verification
- learning experience application
- profile/passport data
- participation status

### SDK Mode

The shell uses `packages/passport-sdk` helpers for API calls, session bridge, target path validation, and embedded flow setup.

Use for:

- SHCW front-end integration
- future partner channel websites
- reducing duplicated request signing and response handling

### Embedded Flow Mode

The shell embeds Core-owned flows with channel theming or redirects into Core-hosted flows.

Use for:

- login/register
- event registration
- learning experience application
- verifier scanner
- certificate verification
- dashboard/passport views when deep integration is not required

## 5. Session Bridge

The current implementation includes one-time channel session bridge tokens:

- Core issues a short-lived token for an authenticated Passport session.
- Token is stored hashed at rest in `ChannelSessionBridge`.
- Shell exchanges the token once.
- Core consumes the token and creates the target session.

Required next rules:

- Token TTL must remain short.
- Tokens must be consume-once.
- Tokens must be stored hashed.
- `targetPath` must be allowlisted.
- Replay attempts must be logged.
- Rate limiting must be added to issue/exchange endpoints.
- Shell must not persist bridge tokens as long-lived credentials.

## 6. Channel API Contract Principles

- Core APIs return only data the channel is authorized to display.
- Channel shell must pass channel identity where relevant.
- Channel shell must not decode trusted QR payloads locally.
- Channel shell must not rely on client-side QR contents as source of truth.
- Channel shell must not decide verifier permissions locally.
- Channel shell must not issue Passport IDs.
- Channel shell must not issue certificates outside Core rules.
- Channel shell must not write points, achievements, milestones, or participation records directly.

## 7. Verifier Integration

Verifier is integrated into Climate Passport Core, but exposed as API capability.

SHCW or partner shells can provide a branded scanner UI, but must send the QR payload to Core for:

- decode
- permission check
- event rule check
- registration status check
- attendance confirmation
- verification logging

The shell receives a scoped result such as:

- valid
- invalid
- expired
- revoked
- wrong event
- not registered
- not approved
- already checked in
- permission denied

## 8. Event And Agenda Integration

SHCW may present agenda, event pages, speaker pages, and branded event content.

Registration, approval, attendance, check-in, participation records, points, and certificates must be Core-owned.

Recommended pattern:

- SHCW renders event content.
- Register/apply buttons call or embed Core flows.
- User status widgets read from Core.
- Check-in and participation states read from Core.

## 9. Learning Experience Integration

SHCW may promote a learning experience or show a branded landing page.

Application, review, admission, participation, completion, certificate, points, milestones, and achievements are Core-owned.

## 10. Certificate Integration

SHCW may display certificate-related content and calls to action.

Certificate issue, revocation, verification, download authorization, and verification logs are Core-owned.

Public verification should resolve through `verify.climatepassport.org` or Core verification APIs.

The verification page follows minimum necessary disclosure and verifies the credential, not the person.

## 11. Security Requirements

- Use HTTPS only.
- Use short-lived bridge tokens.
- Hash bridge tokens at rest.
- Add rate limits to bridge and verifier APIs.
- Use target path allowlists.
- Use signed requests or channel credentials for server-to-server calls where needed.
- Never expose Core signing/encryption keys to shell code.
- Never place personal data in QR cleartext.

## 12. Open Questions

1. Final SDK package API shape.
2. Whether SHCW first integrates through redirects, embedded flows, or direct API forms.
3. Channel credential model for server-to-server operations.
4. Target path allowlist ownership and deployment config format.
