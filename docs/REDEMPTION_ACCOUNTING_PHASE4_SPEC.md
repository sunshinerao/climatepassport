# Phase 4 Internal Redemption Accounting Foundation

**Status:** code and local database migration only (2026-09-13). This is an internal accounting foundation, not a redemption product.

## Scope

`RedemptionIntent`, `PointJournal`, and `PointPosting` provide immutable, balanced journal records for a positive point intent. `User.points` remains the legacy earned balance and `PointTransaction` is untouched. `USER_AVAILABLE` is an accounting representation, not a replacement balance: until an explicitly approved ledger cutover, available redemption balance is exactly `User.points` less net outstanding `USER_RESERVED` credits. It must not also subtract `USER_AVAILABLE` postings. No redemption transition decrements `User.points`.

The lifecycle is `CREATED → RESERVED → {CANCELLED|EXPIRED|SETTLED}` and `SETTLED → REFUNDED`. Reserve writes `USER_AVAILABLE` debit / `USER_RESERVED` credit; cancel and expire write `USER_RESERVED` debit / `USER_AVAILABLE` credit; settle writes `USER_RESERVED` debit / `REDEMPTION_CLEARING` credit; refund writes `REDEMPTION_CLEARING` debit / `USER_AVAILABLE` credit. Each transition writes exactly two equal positive postings with opposite debit/credit directions. Journal keys and user-intent keys are unique. The service runs serializable transactions with at most three attempts and returns an existing result for a duplicate transition key. `REDEMPTION_SETTLED` is not used or modeled; the historical local enum value is retained only because PostgreSQL enum values cannot be removed additively.

## Security and privacy

The server-only service requires actor context; an owner may operate only their own intent, while `settle` and `refund` require `ADMIN`. Audit and in-app notification writes occur in the same transaction and include only intent ID, operation, point amount, and status—never offer details, PII, secrets, or provider responses.

## Explicit provider gates and deferrals

The provider adapter registry is intentionally empty and no network call exists. User/admin UI, offers/catalog/inventory, payment or money handling, webhooks, workers, provider credentials, provider selection, settlement reconciliation, and any external fulfillment require a separately approved package with threat model, provider contract, secret management, operational ownership, reconciliation and rollback policy, and production migration review.
