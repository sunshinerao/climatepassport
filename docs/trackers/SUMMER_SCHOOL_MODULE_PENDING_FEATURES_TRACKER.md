# Summer School Module Pending Features Tracker

Last updated: 2026-05-25

## Completed
- Duplicate lookup behavior aligned to match by email OR Passport ID.
- Lookup filter logic extracted into shared helper (`lib/server/summer-school-lookup.ts`).
- Regression tests added for lookup helper (`tests/summer-school-lookup.test.mjs`).
- Admin applications page remains available with table + print/PDF actions.
- Admin applications table column widths rebalanced: status/submitted narrowed and email widened for better readability (`docs/BUGFIX_SUMMER_SCHOOL_ADMIN_APPLICATIONS_COLUMN_WIDTH_20260525.md`).
- Admin menu label for Summer School applications updated to `*夏校申请列表` (`docs/BUGFIX_SUMMER_SCHOOL_ADMIN_MENU_LABEL_RENAME_20260525.md`).

## In Progress
- Expand automated regression from helper-level to API boundary coverage.
- Continue consistency checks between summer-school compatibility routes and learning-experience canonical domain.

## Pending
- Add dedicated API tests for submit/lookup/read-only lock behavior.
- Add role-and-navigation UX review for admin/event-manager discoverability paths.
