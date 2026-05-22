# Climate Passport

Climate Passport is the new standalone platform repository for the `climatepass.org` product.

## Purpose

This repository is intended to become the system of record for:

- identity and authentication
- passport profiles and passport IDs
- speakers, moderators, organizations, and user roles
- events, agenda, registration, invitations, and attendance
- QR, check-in, verifier workflows, points, milestones, and certificates
- channel delivery for Shanghai Climate Week and future partner websites

## Migration Preservation Principle

The current SHCW user management, Climate Passport, QR, verifier, and related UI flows are already mature and accepted.

- Migrate these capabilities into Climate Passport instead of redesigning them by default.
- Preserve the current working user experience, flow structure, and proven UI patterns unless a change is required by platformization.
- Treat the existing SHCW implementation as the baseline product reference for parity.

## Relationship To The Existing SHCW Repository

The existing Shanghai Climate Week repository remains the current production codebase and migration source.

- Current source repository: `../my-app`
- New target platform repository: `./`

The migration strategy is:

1. keep the old repository operational
2. build Climate Passport here as the new business platform
3. migrate data and business ownership in phases
4. reduce the SHCW repository into a themed channel shell

## Context Continuity

Read these files first before writing platform code:

- `docs/CONTEXT_CONTINUITY_20260518.md`
- `docs/MIGRATION_BOOTSTRAP_20260518.md`
- `docs/CLIMATE_PASSPORT_PLATFORM_PENDING_FEATURES_TRACKER.md`

## Suggested Initial Repository Shape

Planned top-level areas:

- `apps/passport-web` for the climatepass.org web experience
- `apps/passport-admin` for operations and admin surfaces if split later
- `packages/passport-contracts` for API contracts and shared types
- `packages/passport-ui-flows` for themed transaction flows reused by channel shells
- `packages/passport-sdk` for channel integration
- `docs` for migration, architecture, and rollout notes

This repository is intentionally bootstrapped with context documents first so product, schema, and migration decisions are not separated from implementation.

## Bootstrapped Workspace Files

- `package.json` defines the npm workspaces root for upcoming apps and packages
- `tsconfig.base.json` provides a shared TypeScript baseline
- `apps/passport-web` is reserved for the core `climatepass.org` web app
- `packages/passport-contracts` is reserved for shared API and schema contracts
- `packages/passport-ui-flows` is reserved for reusable branded transaction flows
- `packages/passport-sdk` is reserved for channel shell integrations
