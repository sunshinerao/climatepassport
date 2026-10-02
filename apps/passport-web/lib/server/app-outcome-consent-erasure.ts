import type { Prisma } from "@prisma/client";
export function appOutcomeRetentionMs() {
  const days = Number(process.env.CP_APP_OUTCOME_TOMBSTONE_DAYS ?? 30);
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error("Invalid outcome retention configuration.");
  return days * 86400000;
}
/** Consent revocation/supersession must erase the outcome projection in the same transaction. */
export async function eraseAppOutcomeConsent(tx: Prisma.TransactionClient, consentId: string, now = new Date()) {
  const expires = new Date(now.getTime() + appOutcomeRetentionMs());
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    UPDATE app_outcome_streams SET kind = NULL, "outcomeStatus" = NULL,
      "evidenceRefs" = ARRAY[]::text[], "terminalRevoked" = true,
      "suppressedAt" = COALESCE("suppressedAt", ${now}),
      "tombstoneExpiresAt" = COALESCE("tombstoneExpiresAt", ${expires}), "updatedAt" = ${now}
    WHERE "consentId" = ${consentId} OR id IN
      (SELECT "streamId" FROM app_outcome_events WHERE "consentId" = ${consentId} AND state = 'GAP_PENDING')
    RETURNING id`;
  for (const row of rows) {
    await tx.$executeRaw`UPDATE app_outcome_events SET "payloadJson" = NULL,
      state = CASE WHEN state = 'GAP_PENDING' THEN 'BLOCKED' ELSE state END WHERE "streamId" = ${row.id}`;
    await tx.coreAuditLog.create({ data: { action: "app_outcome.suppress", subjectType: "app_outcome", subjectId: row.id, result: "consent_inactive" } });
  }
}
