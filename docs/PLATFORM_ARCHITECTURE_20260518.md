# Climate Passport Platform Architecture

## 1. Positioning

Climate Passport is the business platform and system of record.

Shanghai Climate Week is a themed channel shell.

This means:

- users do not belong to SHCW as a primary system
- events do not belong to SHCW as a primary system
- speakers, moderators, registrations, attendance, QR, points, and milestones do not belong to SHCW as a primary system
- SHCW can still present these experiences in its own visual shell and routes

## 2. Core Product Principle

The current SHCW implementation already contains mature and accepted product flows for:

- user registration and login
- profile and dashboard
- Climate Passport card and QR presentation
- event registration
- verifier check-in and attendance confirmation

These mature flows and their accepted UI structure must be treated as migration baselines by default.

The migration target is not to redesign these by default.

The migration target is to:

- preserve the current working product behavior
- preserve the current accepted UI patterns where feasible
- lift ownership from SHCW into Climate Passport platform modules
- enable the same flows to render in both Passport-native and SHCW-themed shells

The migration target is not to redesign mature features unless platformization, security, or an explicit product request requires change.

## 3. Repository Shape

The initial repository shape is a workspace repository with three early concerns:

- `apps/passport-web`: primary web application for `climatepass.org`
- `packages/passport-contracts`: shared types and contracts
- `packages/passport-ui-flows`: shared themed transaction flows
- `packages/passport-sdk`: integration helpers for SHCW and future partner channels

This structure keeps platform logic centralized while still allowing branded delivery in multiple shells.

## 4. Domain Boundaries

### 4.1 Identity Hub

Owns:

- accounts
- authentication
- session issuance
- password reset
- email verification
- role and access model
- channel account linkage

### 4.2 People Hub

Owns:

- user profiles
- speaker profiles
- moderator or host profiles
- organizations
- role overlays for a single person across multiple contexts

### 4.3 Event Hub

Owns:

- events
- agenda and schedule blocks
- venues and date slots
- tracks and themes
- public visibility and channel visibility

### 4.4 Participation Hub

Owns:

- registrations
- approvals and waitlists
- invitations
- attendance and check-in
- verifier assignment

### 4.5 Passport Ledger

Owns:

- passport identity
- passport QR payload ownership
- points ledger
- achievements
- milestones

### 4.6 Certificate Hub

Owns:

- certificate categories
- certificate definitions and names
- certificate template settings and versioning
- certificate generation jobs
- approval workflows before issuance when required
- verification and authenticity lookup
- user download and archive access
- linkage to achievements, points, milestones, and completion artifacts

Certificate Hub is a required platform module, not only a presentation layer.

### 4.7 Channel Delivery

Owns:

- public read APIs for channel shells
- themed transaction flow delivery
- channel configuration and branding
- session bridge support for branded shells

## 5. Delivery Model

There are two delivery modes for the same platform capabilities.

### 5.1 Passport-native mode

Rendered under `climatepass.org` with Climate Passport branding.

### 5.2 SHCW shell mode

Rendered under SHCW with SHCW branding, but backed by Climate Passport business logic, identity, and data ownership.

The user should be able to feel that they are operating inside SHCW, while the platform still owns:

- identity
- main session trust
- business rules
- source data

## 6. Migration Rules

### 6.1 Preserve Mature Flows

The following flows must be treated as migration baselines:

- login
- register
- forgot password / reset password
- dashboard summary
- passport card and QR
- event registration
- verifier check-in

Change them only when required by:

- platform multi-channel delivery
- security hardening
- domain ownership separation
- explicit product change requests

When migrating mature features, preserve current logic, interaction sequence, and accepted UI structure wherever feasible.

### 6.2 Preserve Existing Data

Do not discard or overwrite current production data.

Migration must preserve, at minimum:

- user records
- passport IDs
- pass codes or compatible successor identity values
- event records
- speaker records
- registrations
- check-in history
- points history

### 6.3 Avoid Dual Ownership

SHCW may temporarily proxy or wrap flows, but long-term ownership must converge into Climate Passport.

## 7. First Build Sequence

1. scaffold the repository and architecture documents
2. define source-to-target schema mapping from SHCW
3. implement first-pass Passport domain schema
4. build Passport-native baseline screens using accepted SHCW patterns
5. add SHCW themed shell integration path
6. add Certificate Hub domain models and issuance workflows

## 8. Immediate Decisions Still Open

- whether verifier stays inside `passport-web` or becomes a separate operations app
- whether the first release uses a single app or web plus admin split
- whether SHCW shell pages proxy server-side or embed Passport flow components directly
