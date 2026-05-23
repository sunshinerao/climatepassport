# Learning Experiences Pending Features Tracker

## Status Legend

- `todo`: not started
- `doing`: in progress
- `done`: completed
- `blocked`: blocked by dependency or decision

## 1. Domain Definition

- [x] LE-TODO-001 `done` formalize Learning Experiences as a Program/Application domain instead of collapsing it into Event
- [x] LE-TODO-002 `done` define and implement the target Prisma models for program, application, stage, participation, and event-link entities
- [ ] LE-TODO-003 `todo` define migration compatibility from existing Summer School / Learning Experience artifacts into the Passport target domain

## 2. User Flows

- [x] LE-TODO-004 `done` implement public discovery/apply entry surfaces under Climate Passport with runnable dashboard page and apply APIs
- [x] LE-TODO-005 `done` implement applicant dashboard lifecycle from draft to submit with live status tracking
- [ ] LE-TODO-006 `doing` implement admin review lifecycle (status transitions and participation linkage shipped; deeper cohort operations pending)

## 3. Passport Linkage

- [ ] LE-TODO-007 `todo` define how completion, certificate, points, and milestones are written back to Climate Passport
- [ ] LE-TODO-008 `todo` define how LE-owned ceremonies or sessions link to Event without flattening LE into Event registration
