# Auth credential rotation: explicit revocation, not a secret-only assumption

`AUTH_EMAIL_CODE_SECRET` protects six-digit code hashes. `AUTH_EMAIL_CREDENTIAL_VERSION` is a required, non-secret revocation epoch shared by public issuers, confirmers and outbox workers. Tokens persist the epoch and include it in code HMAC context. The reserved migration value `legacy` cannot be used as configured current epoch.

## Verified code semantics

- Changing only the HMAC secret rejects old six-digit codes and counts those failures toward the old challenge budget. It does **not** revoke SHA-256 high-entropy links. Missing secret fails code validation/issuance closed without mutating attempts.
- Changing the credential version makes both old links and codes fail before consumption or attempt increment. Older outbox requests are skipped before dispatch. New credentials carry the new epoch, and intentionally revoked old-epoch attempt budgets do not lock out the new epoch. Within a fixed epoch, reissue still cannot reset a live guessing budget.
- No fallback secret/version is accepted. This is not a zero-downtime mixed-version rotation protocol. Old processes running old configuration can still accept their old epoch until stopped.
- A provider call already in flight cannot be retracted. A received old email's credentials will nevertheless fail once all confirmers enforce the new epoch. UNKNOWN queue outcomes are not automatically resent.

## Safe explicit cutover procedure (not executed)

1. Place registration, verification/reset request and confirmation endpoints behind an operator-controlled maintenance gate. Pause the external worker scheduler and stop admitting new batches. Record jobs already PROCESSING; allow in-flight calls to finish where possible and classify abandoned leases as UNKNOWN. Never replay them blindly.
2. Stop/drain **all** old issuer, confirmer and worker instances. Verify none can receive traffic or restart with old configuration. If that cannot be guaranteed, do not claim global revocation.
3. Through the approved secret manager, configure the replacement `AUTH_EMAIL_CODE_SECRET` and a new `AUTH_EMAIL_CREDENTIAL_VERSION` together for every relevant instance. Do not reuse an old version identifier and do not put secret values in shell history, logs, source control or this document. Rotate `AUTH_MAIL_WORKER_SECRET` separately when the scheduler credential itself needs replacement.
4. Start only the new configuration with the maintenance gate still closed. In an isolated synthetic environment, check old code/link rejection without attempts change, new issuance/confirmation, old-epoch pending job skipping, and no retries for UNKNOWN outcomes. Inspect only sanitized status/diagnostic codes. No production mail test is authorized by this document.
5. Reopen confirmation/request traffic and enable the externally managed worker schedule only after the checks and deployment approval. Tell users to request fresh instructions. Old rows are logically revoked by epoch; any physical cleanup is a separately authorized database operation, not required to make the old credential unusable.

For secret compromise, the epoch change is required for full email-credential revocation. It does not invalidate already established login sessions by itself; incident response requiring session revocation needs a separately approved operation. Password reset and verification still revoke sessions transactionally for the affected account.

No real secret, rotation, scheduler configuration or database mutation was performed during implementation.
