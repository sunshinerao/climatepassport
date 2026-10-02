import { isMailRecipientAllowed } from "./mail-recipient-policy";
import { createHash, randomUUID } from "crypto";
import { getPrismaClient } from "@/lib/server/prisma";
import { getAuthCredentialVersion } from "@/lib/server/auth-email-security";
import { createEmailToken, sendVerificationEmail, sendResetPasswordEmail } from "@/lib/server/auth-email";
import { generateClimatePassportId } from "@/lib/server/auth";

export type AuthMailKind = "REGISTER" | "VERIFY" | "RESET";
export type AuthMailProfile = { name: string; salutation?: string; title?: string; phone?: string; country?: string; organizationName?: string };
type Payload = { locale: "zh" | "en"; profile?: AuthMailProfile };
export type ClaimedAuthMailRequest = { id: string; kind: string; email: string; payload: unknown; credentialVersion: string; leaseId: string | null; attempts: number; createdAt: Date; leaseExpiresAt: Date };
const WINDOW_MS = 10 * 60_000;
const LEASE_MS = 5 * 60_000;
const MAX_ATTEMPTS = 3;
const REQUEST_MAX_AGE_MS = 30 * 60_000;
const PROFILE_FIELDS = ["name", "salutation", "title", "phone", "country", "organizationName"];
function db() { const prisma = getPrismaClient(); if (!prisma) throw new Error("AUTH_OUTBOX_UNAVAILABLE"); return prisma; }

function developmentScope(): { createdAt: { gte: Date }; runId: string } | null {
  if (process.env.CP_DEV_GMAIL_ONLY !== "1") return null;
  const date = new Date(process.env.CP_DEV_MAIL_RUN_STARTED_AT ?? "");
  const runId = process.env.CP_DEV_MAIL_RUN_ID ?? "";
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== process.env.CP_DEV_MAIL_RUN_STARTED_AT ||
      date.getTime() > Date.now() + 30_000 || !/^[A-Za-z0-9_-]{16,64}$/.test(runId)) throw new Error("AUTH_OUTBOX_DEV_SCOPE_INVALID");
  return { createdAt: { gte: date }, runId };
}

function developmentMailWindow(): { ready: boolean; retryAt?: number } {
  if (process.env.CP_DEV_GMAIL_ONLY !== "1") return { ready: true };
  const hooks = (globalThis as typeof globalThis & { __cpDevelopmentAuthMail?: { readiness(): { ready: boolean; retryAt?: number } } }).__cpDevelopmentAuthMail;
  if (!hooks) throw new Error("AUTH_OUTBOX_DEV_GUARD_MISSING");
  return hooks.readiness();
}
async function deferDevelopmentWindow(job: ClaimedAuthMailRequest): Promise<boolean> {
  const gate = developmentMailWindow();
  if (gate.ready) return false;
  await db().authMailOutbox.updateMany({ where: { id: job.id, leaseId: job.leaseId, status: "PROCESSING" }, data: {
    status: "PENDING", attempts: Math.max(0, job.attempts - 1), nextAttemptAt: new Date(gate.retryAt ?? Date.now() + 60_000),
    leaseId: null, leaseExpiresAt: null, deliveryStartedAt: null, failureCode: "DEV_SEND_WINDOW_WAIT",
  } });
  return true;
}

/** Account-independent durable acknowledgment. No user lookup, password hashing or mail I/O. */
export async function enqueueAuthMailRequest(input: { kind: AuthMailKind; email: string; locale: "zh" | "en"; profile?: AuthMailProfile }): Promise<void> {
  if (!input || Object.keys(input).some(key => !["kind", "email", "locale", "profile"].includes(key)) ||
      !["REGISTER", "VERIFY", "RESET"].includes(input.kind) || !["zh", "en"].includes(input.locale) ||
      typeof input.email !== "string" || input.email.length > 254 || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(input.email.trim())) throw new Error("AUTH_OUTBOX_INVALID");
  const email = input.email.trim().toLowerCase();
  if (!isMailRecipientAllowed(email)) throw new Error("AUTH_OUTBOX_RECIPIENT_NOT_ALLOWED");
  const payload: Payload = { locale: input.locale };
  if (input.profile !== undefined) {
    if (input.kind !== "REGISTER" || !input.profile || Object.keys(input.profile).some(key => !PROFILE_FIELDS.includes(key)) ||
        typeof input.profile.name !== "string" || !input.profile.name.trim() ||
        Object.values(input.profile).some(value => value !== undefined && (typeof value !== "string" || value.length > 160))) throw new Error("AUTH_OUTBOX_INVALID");
    payload.profile = Object.fromEntries(Object.entries(input.profile).filter(([, value]) => value !== undefined)) as AuthMailProfile;
  }
  if (input.kind === "REGISTER" && !payload.profile) throw new Error("AUTH_OUTBOX_INVALID");
  const credentialVersion = getAuthCredentialVersion();
  const bucket = Math.floor(Date.now() / WINDOW_MS);
  const scope = developmentScope();
  const dedupeKey = createHash("sha256").update(JSON.stringify([credentialVersion, input.kind, email, bucket, ...(scope ? [scope.runId] : [])])).digest("hex");
  const prisma = db();
  const enqueue = () => prisma.authMailOutbox.upsert({ where: { dedupeKey }, create: { kind: input.kind, email, payload, credentialVersion, dedupeKey }, update: {}, select: { id: true } });
  try { await enqueue(); } catch (error) {
    if ((error as { code?: string }).code !== "P2002") throw new Error("AUTH_OUTBOX_UNAVAILABLE");
    try { await enqueue(); } catch { throw new Error("AUTH_OUTBOX_UNAVAILABLE"); }
  }
}

async function claim(): Promise<ClaimedAuthMailRequest | null> {
  const prisma = db();
  const now = new Date();
  const scope = developmentScope();
  if (scope && !developmentMailWindow().ready) return null;
  const scoped = scope ? { createdAt: scope.createdAt } : {};
  // Never re-claim crashed workers: send may already have happened. A fresh user
  // request in a later dedupe window is distinct from retrying uncertain delivery.
  await prisma.authMailOutbox.updateMany({ where: { ...scoped, status: "PROCESSING", leaseExpiresAt: { lte: now } }, data: { status: "UNKNOWN", failureCode: "LEASE_EXPIRED" } });
  for (let conflict = 0; conflict < 3; conflict++) {
    const candidate = await prisma.authMailOutbox.findFirst({ where: { ...scoped, status: "PENDING", nextAttemptAt: { lte: now }, attempts: { lt: MAX_ATTEMPTS } }, orderBy: { createdAt: "asc" } });
    if (!candidate) return null;
    const leaseId = randomUUID();
    const leaseExpiresAt = new Date(now.getTime() + LEASE_MS);
    const won = await prisma.authMailOutbox.updateMany({ where: { ...scoped, id: candidate.id, status: "PENDING", nextAttemptAt: { lte: now }, attempts: { lt: MAX_ATTEMPTS } }, data: { status: "PROCESSING", leaseId, leaseExpiresAt, attempts: { increment: 1 }, deliveryStartedAt: null } });
    if (won.count === 1) return { ...candidate, leaseId, leaseExpiresAt, attempts: candidate.attempts + 1 };
  }
  return null;
}
async function finish(job: ClaimedAuthMailRequest, status: string, failureCode?: string) {
  return db().authMailOutbox.updateMany({ where: { id: job.id, leaseId: job.leaseId, status: "PROCESSING" }, data: { status, failureCode: failureCode ?? null } });
}
async function retryBeforeSend(job: ClaimedAuthMailRequest) {
  await db().authMailOutbox.updateMany({ where: { id: job.id, leaseId: job.leaseId, status: "PROCESSING", leaseExpiresAt: { gt: new Date() } }, data: {
    status: job.attempts < MAX_ATTEMPTS ? "PENDING" : "FAILED", failureCode: "PRE_SEND_FAILURE",
    nextAttemptAt: new Date(Date.now() + 60_000 * job.attempts), leaseId: null, leaseExpiresAt: null, deliveryStartedAt: null,
  } });
}

async function dispatch(job: ClaimedAuthMailRequest) {
  let credentialId: string | undefined;
  let deliveryStarted = false;
  try {
    if (!isMailRecipientAllowed(job.email)) { await finish(job, "SKIPPED", "RECIPIENT_NOT_ALLOWED"); return; }
    if (job.createdAt.getTime() + REQUEST_MAX_AGE_MS <= Date.now()) { await finish(job, "SKIPPED", "REQUEST_EXPIRED"); return; }
    if (job.credentialVersion !== getAuthCredentialVersion()) { await finish(job, "SKIPPED", "CREDENTIAL_VERSION_CHANGED"); return; }
    if (await deferDevelopmentWindow(job)) return;
    const prisma = db();
    const payload = job.payload as Payload;
    if (!payload || !["zh", "en"].includes(payload.locale)) { await finish(job, "FAILED", "INVALID_JOB"); return; }
    let user = await prisma.user.findUnique({ where: { email: job.email } });
    if (job.kind === "REGISTER" && !user) {
      const profile = payload.profile;
      if (!profile?.name) { await finish(job, "FAILED", "INVALID_JOB"); return; }
      const climatePassportId = await generateClimatePassportId();
      try {
        user = await prisma.user.create({ data: {
          email: job.email, name: profile.name, password: "", status: "ACTIVE", emailVerified: null, role: "ATTENDEE", climatePassportId,
          phone: profile.phone ?? null, country: profile.country ?? null, salutation: profile.salutation ?? null, title: profile.title ?? null,
          ...(profile.organizationName ? { organization: { create: { name: profile.organizationName } } } : {}),
          notificationPreference: { create: { emailEnabled: true, inAppEnabled: true, smsEnabled: false } },
        } });
      } catch (error) {
        if ((error as { code?: string }).code !== "P2002") throw error;
        user = await prisma.user.findUnique({ where: { email: job.email } });
      }
    }
    const purpose = job.kind === "RESET" ? "RESET_PASSWORD" : "VERIFY_EMAIL";
    if (!user || user.status !== "ACTIVE" || (purpose === "VERIFY_EMAIL" ? user.emailVerified !== null : user.emailVerified === null)) { await finish(job, "SKIPPED"); return; }
    if (await deferDevelopmentWindow(job)) return;
    const credential = await createEmailToken({ userId: user.id, email: job.email, purpose });
    credentialId = credential.credentialId;
    if (!credentialId) throw new Error("CREDENTIAL_REFERENCE_MISSING");
    if (credential.expiresAt <= new Date() || job.credentialVersion !== getAuthCredentialVersion()) {
      await prisma.authEmailToken.updateMany({ where: { id: credentialId, consumedAt: null }, data: { consumedAt: new Date() } });
      await finish(job, "SKIPPED", "CREDENTIAL_NO_LONGER_VALID"); return;
    }
    // Last atomic fence before transport. Expired/lost leases cannot send.
    const started = await prisma.authMailOutbox.updateMany({ where: { id: job.id, leaseId: job.leaseId, status: "PROCESSING", leaseExpiresAt: { gt: new Date() }, deliveryStartedAt: null }, data: { deliveryStartedAt: new Date(), credentialId } });
    if (started.count !== 1) {
      await prisma.authEmailToken.updateMany({ where: { id: credentialId, consumedAt: null }, data: { consumedAt: new Date() } });
      return;
    }
    // Re-read after the awaited fence: reset, reissue, rotation or elapsed time
    // may have invalidated this credential while database work was pending.
    const currentCredential = await prisma.authEmailToken.findUnique({ where: { id: credentialId } });
    const beforeSend = new Date();
    if (job.leaseExpiresAt <= beforeSend || !currentCredential || currentCredential.consumedAt || currentCredential.expiresAt <= beforeSend ||
        credential.expiresAt <= beforeSend || currentCredential.credentialVersion !== getAuthCredentialVersion() ||
        job.credentialVersion !== currentCredential.credentialVersion || job.createdAt.getTime() + REQUEST_MAX_AGE_MS <= beforeSend.getTime()) {
      await prisma.authEmailToken.updateMany({ where: { id: credentialId, consumedAt: null }, data: { consumedAt: beforeSend } });
      await finish(job, "SKIPPED", "CREDENTIAL_NO_LONGER_VALID"); return;
    }
    deliveryStarted = true;
    const send = purpose === "RESET_PASSWORD" ? sendResetPasswordEmail : sendVerificationEmail;
    await send({ locale: payload.locale, email: job.email, token: credential.token, code: credential.code });
    // SENT means provider accepted, never mailbox delivery.
    await finish(job, "SENT");
  } catch (error) {
    // No provider body, recipient, token or arbitrary error string is persisted.
    const outcome = (error as { outcome?: string }).outcome;
    if (credentialId) {
      try { await db().authEmailToken.updateMany({ where: { id: credentialId, consumedAt: null }, data: { consumedAt: new Date() } }); }
      catch { await finish(job, "UNKNOWN", "CREDENTIAL_REVOCATION_UNCERTAIN"); return; }
    }
    if (!deliveryStarted || outcome === "not-attempted") { await retryBeforeSend(job); return; }
    await finish(job, outcome === "rejected" ? "FAILED" : "UNKNOWN", outcome === "rejected" ? "PROVIDER_REJECTED" : "DELIVERY_UNCERTAIN");
  }
}

/** Controlled server worker only; public auth routes must call enqueue exclusively. */
export async function processAuthMailBatch(maxJobs = 5): Promise<{ processed: number }> {
  if (!Number.isInteger(maxJobs) || maxJobs < 1 || maxJobs > 20) throw new Error("AUTH_OUTBOX_BATCH_INVALID");
  let release: (() => void) | null = null;
  if (process.env.CP_DEV_GMAIL_ONLY === "1") {
    const hooks = (globalThis as typeof globalThis & { __cpDevelopmentAuthMail?: { acquireBatch(): (() => void) | null } }).__cpDevelopmentAuthMail;
    if (!hooks) throw new Error("AUTH_OUTBOX_DEV_GUARD_MISSING");
    release = hooks.acquireBatch();
    if (!release) return { processed: 0 };
  }
  try {
    let processed = 0;
    while (processed < maxJobs) { const job = await claim(); if (!job) break; await dispatch(job); processed++; }
    return { processed };
  } finally { release?.(); }
}
