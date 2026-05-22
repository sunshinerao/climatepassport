# Climate Passport Platform Pending Features Tracker

## Status Legend

- `todo`: not started
- `doing`: in progress
- `done`: completed
- `blocked`: blocked by dependency or decision

## 1. Platform Foundation

- [ ] CP-TODO-001 `todo` define target bounded contexts for identity, people, events, participation, and passport ledger
- [x] CP-TODO-002 `done` draft target repository architecture and deployment topology for `climatepass.org`
- [ ] CP-TODO-003 `todo` decide whether web and admin launch from one app or split apps
- [ ] CP-TODO-021 `todo` codify migration preservation rules for mature SHCW user, passport, verifier, and dashboard flows
- [ ] CP-TODO-025 `todo` define Certificate Hub bounded context and its linkage to points, achievements, and milestones

## 2. Data Migration

- [x] CP-TODO-004 `done` inventory source SHCW tables, enums, and critical relationships
- [x] CP-TODO-005 `done` define source-to-target field mapping for users, speakers, events, registrations, and check-ins
- [ ] CP-TODO-006 `todo` design migration strategy for preserving existing IDs and historical timestamps
- [x] CP-TODO-007 `done` prepare first migration script against a database snapshot
- [x] CP-TODO-023 `done` document module migration matrix for what moves to Climate Passport versus what stays in the SHCW themed shell
- [x] CP-TODO-028 `done` draft the first Prisma schema covering phase-one platform domains and Certificate Hub
- [x] CP-TODO-029 `done` add a server-side data loader layer for passport-web routes so page rendering can switch to Prisma without changing route UI structure
- [x] CP-TODO-030 `done` scaffold a dry-run migration bootstrap script that fixes migration order and environment requirements
- [x] CP-TODO-031 `done` wire the first passport-web server loaders to Prisma with a safe fallback so real data can be introduced without breaking current route validation
- [x] CP-TODO-032 `done` add a Prisma seed baseline so passport-web can display real Climate Passport platform data as soon as a local database is available
- [x] CP-TODO-033 `done` upgrade the migration bootstrap into a real source extraction script for SHCW users, events, and registrations
- [x] CP-TODO-034 `done` add the first target import pipeline for tracks, users, events, and registrations using preserved source IDs and timestamps
- [x] CP-TODO-035 `done` extend the migration pipeline to include event verifiers, checkins, point transactions, invitation requests, and special passes
- [x] CP-TODO-036 `done` extend the migration pipeline to include institutions, speakers, speaker roles, agenda items, and speaker-agenda links
- [x] CP-TODO-037 `done` wire passport-web to render real speakers and agenda data from the migrated Climate Passport database
- [x] CP-TODO-038 `done` add Passport-owned static info pages plus messages and notifications surfaces in passport-web

## 3. Identity And Access

- [x] CP-TODO-008 `done` design and implement Passport-native auth and session model
- [x] CP-TODO-009 `done` define and implement SHCW shell channel session bridge token issue/exchange APIs
- [x] CP-TODO-010 `done` define the first runnable platform role gates for attendee, admin, and event manager access

## 4. Core Domain Modules

- [ ] CP-TODO-011 `todo` define people hub models for users, speakers, moderators, and organizations
- [ ] CP-TODO-012 `todo` define event hub models for events, agenda, venues, tracks, and visibility
- [ ] CP-TODO-013 `todo` define participation models for registration, invitation, attendance, and check-in
- [ ] CP-TODO-014 `todo` define passport ledger models for points, achievements, milestones, and certificates
- [ ] CP-TODO-026 `todo` define Certificate Hub models for category, definition, template, issue, approval, verification, and download lifecycle
- [ ] CP-TODO-027 `todo` define how mature existing logic and accepted UI stay preserved during migration implementation

## 5. Channel Delivery

- [ ] CP-TODO-015 `todo` define read APIs for SHCW branded content surfaces
- [ ] CP-TODO-016 `todo` define themed transaction flow strategy for login, register, apply, dashboard, and verifier views
- [ ] CP-TODO-017 `todo` define channel configuration model for branding, copy, and route wrappers
- [ ] CP-TODO-022 `todo` define how SHCW themed shell reuses current accepted UI flows without product regression

## 6. Rollout

- [ ] CP-TODO-018 `todo` design phased cutover plan from SHCW monolith to Climate Passport platform
- [ ] CP-TODO-019 `todo` list regression checks for login, event registration, passport QR, and verifier flows after migration
- [ ] CP-TODO-020 `todo` define launch criteria for climatepass.org independent deployment

## 7. Content And Shell Boundary

- [ ] CP-TODO-024 `todo` define which existing SHCW admin content modules remain shell-owned versus platform-owned

## 8. Runnable Productization

- [x] CP-TODO-039 `done` implement live register/login/logout/session APIs and session-aware dashboard routing in `passport-web`
- [x] CP-TODO-040 `done` deliver role-aware admin event management for `ADMIN` and `EVENT_MANAGER`
- [x] CP-TODO-041 `done` switch dashboard messages and notifications to persisted per-user models instead of generic derived feeds
- [x] CP-TODO-042 `done` formalize Learning Experiences as an independent application/program domain linked to Event and Passport with Prisma models plus admin/public APIs
- [x] CP-TODO-043 `done` add notification preference mutation and contact message submit APIs with dashboard form wiring
- [x] CP-TODO-044 `done` complete Learning Experiences runnable closed loop in `passport-web` (user apply workspace, draft/save/submit APIs, admin status transitions, participation sync)
- [x] CP-TODO-045 `done` ship first SHCW-aligned visual and copy productization pass for passport-web shell/home/auth so routes read as operational platform modules instead of demo baseline wording