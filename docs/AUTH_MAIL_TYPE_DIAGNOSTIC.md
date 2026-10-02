# Bounded type/runtime prerequisite diagnosis — after review package v2

No product source or schema was changed in this diagnostic pass. No dependency install, real database connection, credential read, migration, provider call or deployment was performed. No any/ts-ignore, weakened compiler settings, fake client or fake engine was introduced.

## What the 261 diagnostics mean

Comparison uses the saved 257-diagnostic baseline at commit `913720bff568937f37744aa8124da75a37bc7917` and current full-project `tsc --noEmit --incremental false` log. Matching ignores line movement but preserves file, diagnostic code, message and multiplicity.

| Classification | Count | Evidence/limit |
| --- | ---: | --- |
| Direct missing generated Prisma exports | 39 | 38 TS2305 and 1 TS2694 explicitly name @prisma/client exports |
| Likely downstream errors, unresolved until generation | 222 | 194 implicit-any, 14 missing properties, 8 unknown catch values, 4 argument mismatches, 2 untyped generic calls; propagated Prisma types are unavailable |
| Confirmed genuine new source errors | 0 confirmed | This is not proof there are none; missing client also masks checks in new outbox code |
| Confirmed genuine pre-existing source errors | 0 independently established | Cannot classify existing diagnostics as genuine source defects without real generated types |

Provenance is separately measurable: **256 current diagnostics match the baseline; 5 are new diagnostics; 1 old diagnostic disappeared.** New five are two missing Prisma type references (auth-email/auth) plus three transaction callback inference errors in auth.ts. The removed one was an old register transaction callback inference error. None of those five is evidence of a new product defect independent of missing Prisma generation. The 222 likely cascades are not falsely certified as resolved. A per-diagnostic JSON inventory is included in the review archive.

## Installed official offline-generation attempt

Installed Prisma and client are 5.22.0. CLI help supports `generate --no-engine` (documented there as Accelerate client generation). We tried that official command against a copy of the current schema with output directed solely to `/tmp/cp-type-diagnostic/current/generated`, from an isolated temporary directory and a minimal environment with synthetic loopback URLs. A preload refused outbound HTTP/HTTPS/fetch; it did not redirect or substitute any downloads. No repository .env was loaded and no generated output was produced.

Despite `--no-engine`, this installed CLI attempted engine checksum bootstrap downloads, including both libquery_engine and schema-engine. The offline attempt stopped with `OFFLINE_DIAGNOSTIC_NETWORK_DISABLED`. The local official CLI implementation's getGenerators path requests engine paths before the noEngine output setting is applied. No supported CLI offline path succeeded here. We did not modify dependencies, use an internal ad-hoc schema parser, supply a fake engine path or synthesize declarations. Therefore a complete generated-client typecheck remains blocked; even a successful no-engine typecheck would not prove PostgreSQL runtime or application build.

The previously recorded real official download failure was:

`Failed to fetch sha256 checksum at https://binaries.prisma.sh/all_commits/605197351a3c8bdd595af2d2a9bc3025bca48ea2/debian-openssl-3.0.x/libquery_engine.so.node.gz.sha256 - 403 Forbidden`

Normal resolution: have the environment/network administrator permit the required official binaries.prisma.sh artifact and checksum requests for the pinned Prisma engine revision, then rerun normal locked dependency/client generation. Preserve checksum verification. Alternatively use an approved build environment that normally reaches the official host. No mirror, alternate network route, checksum bypass or version upgrade was attempted.

## Local capabilities observed now

- No postgres or psql executable on PATH; no PostgreSQL process was started.
- Docker CLI and **local** `/var/run/docker.sock` are now available; local server reports 28.4.0.
- `docker --host unix:///var/run/docker.sock image ls` returned no images. No PostgreSQL image was pulled and no container was started.
- This updates the earlier snapshot where the local socket was absent. A Docker daemon alone does not establish an isolated database ready for use. No remote Docker context or database was contacted.

## Minimum operator configuration

1. Provide a new, empty, disposable PostgreSQL database of the intended deployment major version, with a dedicated test-only role capable of applying the migration chain. For local Docker, provision an approved official PostgreSQL image and bind only loopback; do not reuse any existing database. Keep all test data synthetic.
2. Resolve official engine downloads, generate the real client, rerun complete typecheck/build, then execute the isolated concurrency/migration plan in `AUTH_MAIL_INDEPENDENT_REVIEW.md`.
3. Supply variables through an approved environment/secret manager, not chat: `DATABASE_URL`, `DIRECT_URL`, `AUTH_PUBLIC_ORIGIN`, `AUTH_EMAIL_CODE_SECRET`, `AUTH_EMAIL_CREDENTIAL_VERSION`, `AUTH_MAIL_WORKER_SECRET`, `MAIL_PROVIDER`, `MAIL_FROM`, `ZOHO_MAIL_ENDPOINT`, `ZOHO_MAIL_TOKEN`, `NODE_ENV`. `RESEND_API_KEY` is needed only when Resend is explicitly selected. Do not populate real provider credentials for mocked isolated tests.
4. For eventual delivery, configure a durable external scheduler/supervisor to invoke the authenticated worker POST, with its secret only in the dedicated header. Begin with bounded batch size one and a runtime deadline covering database work plus the transport timeout; size schedule/capacity to avoid the 30-minute stale-request cutoff. Persisted queue survives app restarts, but no automatic scheduler exists. Monitor age, FAILED/UNKNOWN states; never automatically replay UNKNOWN. Worker startup and real provider acceptance remain separate authorized deployment gates.

No code corrections were justified from this incomplete type information. Existing 172/172 mock tests and independent 134/134 review remain the last verified results; they were not relabeled as a fresh runtime/build acceptance. Stop here until approved database/runtime configuration and official engine access are available; no password or secret needs to be sent to chat.
