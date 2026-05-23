# Summer School Module Pending Features Tracker

Last updated: 2026-05-23

## Completed
- Duplicate lookup behavior aligned to match by email OR Passport ID.
- Lookup filter logic extracted into shared helper (`lib/server/summer-school-lookup.ts`).
- Regression tests added for lookup helper (`tests/summer-school-lookup.test.mjs`).
- Admin applications page remains available with table + print/PDF actions.

## In Progress
- Expand automated regression from helper-level to API boundary coverage.
- Continue consistency checks between summer-school compatibility routes and learning-experience canonical domain.

## Pending
- Add dedicated API tests for submit/lookup/read-only lock behavior.
- Add role-and-navigation UX review for admin/event-manager discoverability paths.
