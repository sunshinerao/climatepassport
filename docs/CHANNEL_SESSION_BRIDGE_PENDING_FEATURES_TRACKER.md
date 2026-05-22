# Channel Session Bridge Pending Features Tracker

## Status Legend

- `todo`: not started
- `doing`: in progress
- `done`: completed
- `blocked`: blocked by dependency or decision

## 1. Bridge Core

- [x] BRIDGE-TODO-001 `done` implement one-time channel bridge token issue API for authenticated Passport sessions
- [x] BRIDGE-TODO-002 `done` implement one-time channel bridge token exchange API and consume-once semantics
- [x] BRIDGE-TODO-003 `done` persist bridge records with expiry and consumed timestamps for auditability

## 2. Security And Operations

- [ ] BRIDGE-TODO-004 `todo` add rate limiting and abuse guardrails for bridge token issue/exchange endpoints
- [ ] BRIDGE-TODO-005 `todo` add replay-attack monitoring metrics and alert thresholds
- [ ] BRIDGE-TODO-006 `todo` formalize token signing/encryption policy if shell-side transport needs stronger integrity guarantees

## 3. Channel Integration

- [ ] BRIDGE-TODO-007 `todo` implement SHCW shell client-side exchange helper and redirect orchestration
- [ ] BRIDGE-TODO-008 `todo` define channel contract for `targetPath` allowlist and fallback routing behavior
- [ ] BRIDGE-TODO-009 `todo` add end-to-end integration tests across Passport and SHCW shell environments
