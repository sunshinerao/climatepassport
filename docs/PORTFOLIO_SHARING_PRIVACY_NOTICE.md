# Verified Portfolio Sharing Privacy Notice (Phase 3A)

Last updated: 2026-09-13. This local-only implementation derives a portfolio at request time from currently verified Core records. It does not create a public profile directory.

Sharing is private by default. The owner explicitly selects only `name`, `title`, `dimensions`, and/or safe evidence summaries, acknowledges policy version `portfolio-sharing-v1`, and may revoke a link. Tokens are opaque, stored only as SHA-256 hashes, expiry and access caps are atomically enforced, and raw tokens are returned once at creation.

Public projections never disclose email, phone, contacts, internal user IDs, Passport IDs, raw evidence, review notes, reviewer information, source IDs, or provider account data. Only already-public certificate verification URLs can appear. Token responses and pages are noindex.

Deferred: LMS/provider apply flows, background jobs, recruitment/matching, AI scoring, DID/VC issuance, public identifier lookup, partner search, generic uploads, and bulk export.
