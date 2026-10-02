import { appOutcomeRetentionMs, eraseAppOutcomeConsent } from "./app-outcome-consent-erasure";
import { createHash } from "node:crypto";
import { Prisma, type PrismaClient, type AppOutcomeEvent, type AppOutcomeSource, type AppOutcomeBinding, type AppOutcomeStream } from "@prisma/client";
import { AppOutcomeEventSchema, AppOutcomeReceiptSchema, APP_OUTCOME_KINDS, type AppOutcomeEnvelope } from "@climate-passport/passport-contracts";

type Tx = Prisma.TransactionClient;
export class AppOutcomeFailure extends Error {
  constructor(public code: string, public status: number, message: string) { super(message); }
}
function fail(code: string, status: number, message: string): never { throw new AppOutcomeFailure(code, status, message); }
export function outcomeCanonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(outcomeCanonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${outcomeCanonical((value as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
export function outcomeDigest(value: unknown) { return createHash("sha256").update(outcomeCanonical(value)).digest("hex"); }
export function outcomeSubjectHash(issuer: string, clientId: string, subject: string) { return outcomeDigest([issuer, clientId, subject]); }
export function outcomeWireStream(e: AppOutcomeEnvelope) { return JSON.stringify([e.sourceApp, e.sourceAuthority, e.identity.issuer, e.identity.subject, e.sourceRecord.id]); }
const retentionMs = appOutcomeRetentionMs();
async function audit(tx: Tx, action: string, streamId: string, result: string) {
  // Avoid duplicating personal identifiers/digests into a second retention store.
  await tx.coreAuditLog.create({ data: { action: `app_outcome.${action}`, subjectType: "app_outcome", subjectId: streamId, result } });
}
async function lock(tx: Tx, key: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}
async function sourceFor(tx: Tx, clientId: string, scope: string) {
  await tx.$queryRaw`SELECT id FROM channel_clients WHERE id = ${clientId} FOR SHARE`;
  await tx.$queryRaw`SELECT id FROM app_outcome_sources WHERE "channelClientId" = ${clientId} FOR SHARE`;
  const source = await tx.appOutcomeSource.findUnique({ where: { channelClientId: clientId }, include: { client: { include: { programme: true } } } });
  if (!source?.isActive || !source.client.allowedScopes.includes(scope) || !source.client.isActive || source.client.type !== "MACHINE" || !source.client.programme.isActive) fail("OUTCOME_SOURCE_DENIED", 403, "Outcome source is not enabled.");
  return source;
}
async function bindingFor(tx: Tx, source: AppOutcomeSource, e: AppOutcomeEnvelope) {
  if (e.sourceApp !== source.sourceApp || e.sourceAuthority !== source.sourceAuthority || e.identity.issuer !== source.identityIssuer) fail("OUTCOME_SOURCE_DENIED", 403, "Source authority or issuer mismatch.");
  const subjectHash = outcomeSubjectHash(source.identityIssuer, source.identityClientId, e.identity.subject);
  await tx.$queryRaw`SELECT id FROM app_outcome_bindings WHERE "sourceId" = ${source.id} AND "subjectHash" = ${subjectHash} AND "sourceRecordId" = ${e.sourceRecord.id} FOR SHARE`;
  const binding = await tx.appOutcomeBinding.findUnique({ where: { sourceId_subjectHash_sourceRecordId: { sourceId: source.id, subjectHash, sourceRecordId: e.sourceRecord.id } }, include: { user: true } });
  if (!binding || binding.status !== "ACTIVE" || !binding.verifiedAt || binding.user.status !== "ACTIVE" || binding.user.anonymizedAt) fail("OUTCOME_BINDING_DENIED", 403, "Verified subject and record ownership binding required.");
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${binding.userId} FOR SHARE`;
  const activeUser = await tx.user.findUnique({ where: { id: binding.userId }, select: { status: true, anonymizedAt: true } });
  if (!activeUser || activeUser.status !== "ACTIVE" || activeUser.anonymizedAt) fail("OUTCOME_BINDING_DENIED", 403, "Subject account is not active.");
  return binding;
}
async function validateConsent(tx: Tx, binding: AppOutcomeBinding, source: AppOutcomeSource, e: Exclude<AppOutcomeEnvelope, {operation: "revoke"}>, now: Date) {
  await tx.$queryRaw`SELECT id FROM consent_records WHERE id = ${e.consent.receiptId} FOR SHARE`;
  const c = await tx.consentRecord.findUnique({ where: { id: e.consent.receiptId } });
  const occurred = new Date(e.occurredAt);
  if (!c || c.status !== "ACTIVE" || c.subjectUserId !== binding.userId || c.grantorUserId !== binding.userId || c.guardianUserId || c.version !== e.consent.version || c.purpose !== "private_archive" || c.channel !== source.sourceApp || c.programmeId !== null || c.objectType !== "app_outcome" || c.objectId !== binding.sourceRecordId || c.createdAt.getTime() !== new Date(e.consent.grantedAt).getTime() || c.createdAt > occurred || c.validFrom > occurred || c.validFrom > now || (c.validUntil && (c.validUntil <= now || c.validUntil <= occurred))) fail("OUTCOME_CONSENT_DENIED", 403, "Exact, current private archive consent required; retrospective opt-in is forbidden.");
  return c;
}
function receipt(row: AppOutcomeEvent, e: AppOutcomeEnvelope, stream: AppOutcomeStream) {
  return AppOutcomeReceiptSchema.parse({ schemaVersion: "app-outcome/1", applied: row.state === "APPLIED", state: row.state.toLowerCase(), eventId: row.eventId, digest: row.digest, sourceRecord: e.sourceRecord, stream: outcomeWireStream(e), remoteRecordRef: stream.id, currentVersion: stream.currentVersion, terminalRevoked: stream.terminalRevoked });
}
async function suppress(tx: Tx, stream: AppOutcomeStream, now: Date) {
  const updated = await tx.appOutcomeStream.update({ where: { id: stream.id }, data: { kind: null, outcomeStatus: null, evidenceRefs: [], terminalRevoked: true, suppressedAt: stream.suppressedAt ?? now, tombstoneExpiresAt: stream.tombstoneExpiresAt ?? new Date(now.getTime() + retentionMs) } });
  await tx.appOutcomeEvent.updateMany({ where: { streamId: stream.id }, data: { payloadJson: Prisma.DbNull } });
  return updated;
}
async function apply(tx: Tx, row: AppOutcomeEvent, e: AppOutcomeEnvelope, stream: AppOutcomeStream, binding: AppOutcomeBinding, source: AppOutcomeSource, now: Date) {
  if (e.sourceRecord.version !== stream.currentVersion + 1) fail("OUTCOME_CONFLICT", 409, "Version is not the next version.");
  if (e.operation === "upsert") {
    if (stream.currentVersion !== 0 || stream.terminalRevoked) fail("OUTCOME_CONFLICT", 409, "Upsert is only valid for a new stream at version one.");
  } else if (!stream.headEventId || e.supersedesEventId !== stream.headEventId) fail("OUTCOME_CONFLICT", 409, "Prior event must be the accepted head of this stream.");
  if (stream.terminalRevoked && e.operation !== "revoke") fail("OUTCOME_REVOKED", 409, "A terminal record cannot be reopened.");
  if (e.operation !== "revoke") await validateConsent(tx, binding, source, e, now);
  else if (!stream.headEventId) fail("OUTCOME_BINDING_DENIED", 403, "Revocation requires an accepted known record.");
  stream = await tx.appOutcomeStream.update({ where: { id: stream.id }, data: {
    currentVersion: e.sourceRecord.version, headEventId: e.eventId,
    ...(stream.terminalRevoked || e.operation === "revoke" ? {} : { tombstoneExpiresAt: null }),
    ...(e.operation === "revoke" ? {} : { kind: e.data.kind, outcomeStatus: e.data.status, evidenceRefs: e.data.evidenceRefs, consentId: e.consent.receiptId, consentVersion: e.consent.version }),
  } });
  if (e.operation === "revoke") {
    stream = await suppress(tx, stream, now);
    await tx.appOutcomeEvent.updateMany({ where: { streamId: stream.id, state: "GAP_PENDING", id: { not: row.id } }, data: { state: "BLOCKED", payloadJson: Prisma.DbNull } });
  }
  await tx.appOutcomeEvent.update({ where: { id: row.id }, data: { state: "APPLIED", appliedAt: now, payloadJson: Prisma.DbNull } });
  await audit(tx, e.operation, stream.id, "applied");
  return stream;
}
export async function ingestAppOutcome(prisma: PrismaClient, clientId: string, raw: unknown, now = new Date()) {
  const parsed = AppOutcomeEventSchema.safeParse(raw);
  if (!parsed.success) fail("INVALID_REQUEST", 400, "Invalid app-outcome/1 envelope.");
  const e = parsed.data;
  if (new Date(e.occurredAt).getTime() > now.getTime() + 300_000) fail("INVALID_REQUEST", 400, "Future event timestamp rejected.");
  const digest = outcomeDigest(e);
  // One source lock orders event-ID conflicts, subject/record bindings and concurrent gap drains.
  return prisma.$transaction(async tx => {
    await lock(tx, `app-outcome:source:${clientId}`);
    const source = await sourceFor(tx, clientId, "channel:outcomes:write");
    const binding = await bindingFor(tx, source, e);
    let stream = await tx.appOutcomeStream.findUnique({ where: { bindingId: binding.id } });
    if (stream?.tombstoneExpiresAt && stream.tombstoneExpiresAt <= now) {
      // Maintenance also performs this deletion. Request fails closed; no implicit re-binding.
      fail("OUTCOME_BINDING_DENIED", 403, "Record retention expired; approved new record binding required.");
    }
    const old = await tx.appOutcomeEvent.findUnique({ where: { sourceId_eventId: { sourceId: source.id, eventId: e.eventId } } });
    if (old) {
      if (old.digest !== digest || old.streamId !== stream?.id) fail("OUTCOME_CONFLICT", 409, "Immutable event ID has different content.");
      return receipt(old, e, stream!);
    }
    if (stream) {
      const blocked = await tx.appOutcomeEvent.findUnique({ where: { streamId_sourceVersion: { streamId: stream.id, sourceVersion: stream.currentVersion + 1 } } });
      if (blocked?.state === "BLOCKED") fail("OUTCOME_BLOCKED", 409, "Permanently quarantined stream. Stop retries; business review and a new approved source record are required.");
    }
    if (e.operation !== "revoke") {
      const kinds: readonly string[] = APP_OUTCOME_KINDS[e.sourceApp];
      if (!kinds.includes(e.data.kind) || !source.allowedKinds.includes(e.data.kind)) fail("OUTCOME_SOURCE_DENIED", 403, "Kind not permitted for this source.");
      await validateConsent(tx, binding, source, e, now);
    } else if (!stream?.headEventId) fail("OUTCOME_BINDING_DENIED", 403, "Revocation requires a known accepted record.");
    if (stream?.terminalRevoked && e.operation !== "revoke") fail("OUTCOME_REVOKED", 409, "Terminal record cannot be reopened.");
    if (e.operation === "upsert" && e.sourceRecord.version !== 1) fail("OUTCOME_CONFLICT", 409, "Initial upsert must be version one.");
    if (!stream) stream = await tx.appOutcomeStream.create({ data: { bindingId: binding.id, evidenceRefs: [], tombstoneExpiresAt: new Date(now.getTime() + retentionMs) } });
    if (e.sourceRecord.version <= stream.currentVersion) fail("OUTCOME_STALE", 409, "Stale version cannot overwrite an accepted version.");
    if (e.sourceRecord.version > stream.currentVersion + 100) fail("OUTCOME_CONFLICT", 409, "Version gap exceeds bounded inbox window.");
    const sameVersion = await tx.appOutcomeEvent.findUnique({ where: { streamId_sourceVersion: { streamId: stream.id, sourceVersion: e.sourceRecord.version } } });
    if (sameVersion) fail("OUTCOME_CONFLICT", 409, "Version already has a different event ID.");
    const row = await tx.appOutcomeEvent.create({ data: { sourceId: source.id, eventId: e.eventId, streamId: stream.id, sourceVersion: e.sourceRecord.version, digest, operation: e.operation, supersedesEventId: e.operation === "upsert" ? null : e.supersedesEventId, occurredAt: new Date(e.occurredAt), consentId: e.operation === "revoke" ? null : e.consent.receiptId, payloadJson: e as unknown as Prisma.InputJsonValue, state: "GAP_PENDING" } });
    if (e.sourceRecord.version > stream.currentVersion + 1) {
      await audit(tx, "receive", stream.id, "gap_pending");
      return receipt(row, e, stream);
    }
    stream = await apply(tx, row, e, stream, binding, source, now);
    // Drain contiguous gaps only after validating their current consent and exact predecessor.
    for (let n = 0; n < 100; n++) {
      const next = await tx.appOutcomeEvent.findUnique({ where: { streamId_sourceVersion: { streamId: stream.id, sourceVersion: stream.currentVersion + 1 } } });
      if (!next || next.state !== "GAP_PENDING" || !next.payloadJson) break;
      const candidate = AppOutcomeEventSchema.parse(next.payloadJson);
      try { stream = await apply(tx, next, candidate, stream, binding, source, now); }
      catch (error) {
        if (!(error instanceof AppOutcomeFailure)) throw error;
        // An immutable reserved version cannot be repaired by changing its event ID/body.
        // Quarantine the stream and erase content rather than leaving a displayed stale archive.
        stream = await suppress(tx, stream, now);
        await tx.appOutcomeEvent.updateMany({ where: { streamId: stream.id, state: "GAP_PENDING" }, data: { state: "BLOCKED", payloadJson: Prisma.DbNull } });
        await audit(tx, "quarantine", stream.id, error.code);
        break;
      }
    }
    return receipt({ ...row, state: "APPLIED" }, e, stream);
  }, { maxWait: 5000, timeout: 15000 });
}
/** Same immutable envelope gives source-bound minimal status; no private evidence is returned. */
export async function reconcileAppOutcome(prisma: PrismaClient, clientId: string, raw: unknown, now = new Date()) {
  const e = AppOutcomeEventSchema.parse(raw);
  return prisma.$transaction(async tx => {
    await lock(tx, `app-outcome:source:${clientId}`);
    const source = await sourceFor(tx, clientId, "channel:outcomes:reconcile");
    const binding = await bindingFor(tx, source, e);
    const stream = await tx.appOutcomeStream.findUnique({ where: { bindingId: binding.id } });
    if (!stream || (stream.tombstoneExpiresAt && stream.tombstoneExpiresAt <= now)) fail("OUTCOME_NOT_FOUND", 404, "Receipt not found.");
    const row = await tx.appOutcomeEvent.findUnique({ where: { sourceId_eventId: { sourceId: source.id, eventId: e.eventId } } });
    if (!row) fail("OUTCOME_NOT_FOUND", 404, "Receipt not found.");
    if (row.streamId !== stream.id || row.digest !== outcomeDigest(e)) fail("OUTCOME_CONFLICT", 409, "Event receipt digest conflict.");
    return receipt(row, e, stream);
  });
}
/** Operator-owned daily task, must be enabled before any real source activation. No public route. */
export async function purgeExpiredAppOutcomes(prisma: PrismaClient, now = new Date()) {
  return prisma.$transaction(async tx => {
    const candidates = await tx.appOutcomeStream.findMany({ where: { terminalRevoked: false }, include: { binding: { include: { source: true } }, events: { where: { state: "GAP_PENDING" }, select: { consentId: true } } } });
    // Expiration and externally superseded/deleted receipts also suppress content during maintenance.
    for (const row of candidates) {
      await lock(tx, `app-outcome:source:${row.binding.source.channelClientId}`);
      for (const id of new Set([row.consentId, ...row.events.map(e => e.consentId)].filter((id): id is string => Boolean(id)))) {
        await tx.$queryRaw`SELECT id FROM consent_records WHERE id = ${id} FOR SHARE`;
        const consent = await tx.consentRecord.findUnique({ where: { id } });
        if (!consent || consent.status !== "ACTIVE" || (consent.validUntil && consent.validUntil <= now)) await eraseAppOutcomeConsent(tx, id, now);
      }
    }
    await tx.appOutcomeEvent.updateMany({ where: { state: "GAP_PENDING", receivedAt: { lte: new Date(now.getTime() - retentionMs) } }, data: { state: "BLOCKED", payloadJson: Prisma.DbNull } });
    const expired = await tx.appOutcomeStream.findMany({ where: { tombstoneExpiresAt: { lte: now } }, select: { bindingId: true, id: true, binding: { select: { source: { select: { channelClientId: true } } } } } });
    for (const row of expired) {
      await lock(tx, `app-outcome:source:${row.binding.source.channelClientId}`);
      const current = await tx.appOutcomeStream.findUnique({ where: { id: row.id } });
      if (!current?.tombstoneExpiresAt || current.tombstoneExpiresAt > now) continue;
      await tx.appOutcomeBinding.delete({ where: { id: row.bindingId } });
      await audit(tx, "purge", row.id, "expired");
    }
    return expired.length;
  }, { timeout: 15000 });
}
export async function listPrivateAppOutcomes(prisma: PrismaClient, userId: string, now = new Date()) {
  return prisma.$transaction(async tx => {
  const rows = await tx.appOutcomeStream.findMany({ where: { terminalRevoked: false, binding: { userId, status: "ACTIVE", source: { isActive: true, client: { isActive: true, programme: { isActive: true } } }, user: { status: "ACTIVE", anonymizedAt: null } } }, include: { binding: { include: { source: true } } }, take: 100, orderBy: { updatedAt: "desc" } });
  const result = [];
  for (const row of rows) {
    if (!row.consentId || !row.currentVersion) continue;
    await tx.$queryRaw`SELECT id FROM consent_records WHERE id = ${row.consentId} FOR SHARE`;
    const c = await tx.consentRecord.findUnique({ where: { id: row.consentId } });
    if (!c || c.status !== "ACTIVE" || c.version !== row.consentVersion || c.subjectUserId !== userId || c.grantorUserId !== userId || c.guardianUserId !== null || c.programmeId !== null || c.purpose !== "private_archive" || c.channel !== row.binding.source.sourceApp || c.objectType !== "app_outcome" || c.objectId !== row.binding.sourceRecordId || c.validFrom > now || (c.validUntil && c.validUntil <= now)) continue;
    result.push({ remoteRecordRef: row.id, sourceApp: row.binding.source.sourceApp, sourceRecord: { id: row.binding.sourceRecordId, version: row.currentVersion }, kind: row.kind, status: row.outcomeStatus, evidenceRefs: row.evidenceRefs, visibility: "private", provenance: "SOURCE_REPORTED" });
  }
  return result;
  });
}
