# Context Continuity For Climate Passport

## Why This File Exists

This document keeps the new Climate Passport repository anchored to the current Shanghai Climate Week implementation so product, schema, and migration decisions do not lose historical context.

## Current Source Of Truth Before Migration

Current operational source repository:

- `../my-app`

Current stack in the source repository:

- Next.js App Router
- Prisma + PostgreSQL
- NextAuth credentials-based authentication
- next-intl bilingual routing
- event, registration, QR, check-in, points, and dashboard logic in one codebase

## What The Existing Repository Currently Owns

The current repository still owns all of the following business domains:

- user registration and login
- user profiles and passport IDs
- speakers and moderator-like people data
- events and agenda
- registration and attendance
- verifier and QR check-in
- points and passport-style milestone presentation

This means the current repository is the migration source, not only a visual reference.

## New Target Ownership

Climate Passport must become the system of record for:

- identity
- account lifecycle
- passport profile and QR identity
- people hub
- event hub
- registration and attendance workflows
- points, achievements, milestones, and certificates
- channel APIs for Shanghai Climate Week and future sites

Shanghai Climate Week should eventually become a themed channel shell that:

- renders brand and editorial surfaces
- reads public and channel-specific data from Climate Passport
- wraps transaction flows in SHCW visual language
- no longer owns the main business data model

## Current High-Risk Couplings To Break

These couplings in the old repository explain why Climate Passport should live in a new repository:

- authentication is bound to the SHCW codebase
- passport identity fields are stored directly on the SHCW user model
- event, check-in, and QR logic are all implemented as SHCW-local APIs
- verifier workflows and dashboard flows are hardwired to SHCW sessions and routes

## Migration Guardrails

- Do not discard existing production data.
- Do not create a second long-term source of truth for users or events.
- Prefer one-way ownership transfer over ongoing bidirectional sync.
- Separate repository ownership first, then separate deployment, then finalize database ownership.

## Recommended Development Sequence

1. define the Climate Passport target schema and ownership boundaries
2. migrate identity, user, people, event, registration, and check-in data into the new platform
3. build Climate Passport web and admin surfaces in this repository
4. switch SHCW write operations to Climate Passport APIs
5. shrink SHCW into a themed shell and read-model consumer

## Immediate Next Deliverables In This Repository

- target architecture document
- source-to-target data mapping document
- first-pass Prisma schema for Climate Passport
- migration scripts from the current SHCW schema
- integration contract for SHCW channel shell
