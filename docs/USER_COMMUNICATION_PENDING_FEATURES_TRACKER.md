# User Communication Pending Features Tracker

## Status Legend

- `todo`: not started
- `doing`: in progress
- `done`: completed
- `blocked`: blocked by dependency or decision

## 1. Notification Preferences

- [x] COMM-TODO-001 `done` add notification preference update API for in-app/email/SMS toggles
- [x] COMM-TODO-002 `done` add dashboard preferences form wired to real API mutations
- [ ] COMM-TODO-003 `todo` add granular topic-level preferences (registration, certificate, invitation, system)

## 2. Notification Feed Actions

- [x] COMM-TODO-004 `done` add API for notification state transition actions (`mark_read`, `archive`)
- [ ] COMM-TODO-005 `todo` wire notification item actions in UI for read/archive state transitions
- [ ] COMM-TODO-006 `todo` add batch actions and unread counters synchronized with dashboard summary cards

## 3. Messages And Contact Workflows

- [x] COMM-TODO-007 `done` add authenticated contact message submission API under dashboard context
- [x] COMM-TODO-008 `done` add dashboard message submit form and success/error feedback
- [ ] COMM-TODO-009 `todo` add user-side message thread detail and admin reply timeline with status transitions
