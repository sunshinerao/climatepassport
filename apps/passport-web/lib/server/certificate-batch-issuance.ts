import { createAchievementRecord } from "@/lib/server/achievement-badge";
import {
  issueCertificateToRecipient,
  normalizeManualVariableValues,
} from "@/lib/server/certificate-issuance";
import { normalizeUserEmail } from "@/lib/server/auth";
import type { PrismaClient } from "@prisma/client";

export const CERTIFICATE_BATCH_SOURCE_TYPE = "CERTIFICATE_BATCH";
export const CERTIFICATE_BATCH_ITEM_SOURCE_ID_PREFIX = "certificate-batch-item:";

const BATCH_ITEM_LEASE_MS = 5 * 60 * 1000;
const DEFAULT_CHUNK_SIZE = 5;
const MAX_CHUNK_SIZE = 10;
const MAX_BATCH_RECIPIENTS = 500;
const MAX_IDEMPOTENCY_KEY_LENGTH = 120;

/// Server-defined eligibility for the Activity eligible-list adapter. The client
/// only picks an activity; it cannot submit arbitrary users for this source.
const ACTIVITY_ELIGIBLE_PARTICIPATION_STATUSES = ["COMPLETED", "CERTIFIED"] as const;

export type CertificateBatchSourceValue = "MANUAL_LIST" | "CSV" | "ACTIVITY_ELIGIBLE_LIST";

export type ParsedRecipientRow = {
  row: number;
  raw: string;
  state: "ok" | "malformed" | "duplicate" | "existing_issue";
  email?: string;
  userId?: string;
  userName?: string;
  issueId?: string;
  verificationCode?: string;
};

export type PreflightReport = {
  ok: boolean;
  error?: string;
  templateId?: string;
  definitionId?: string;
  definitionName?: string;
  rows?: ParsedRecipientRow[];
  recipients?: Array<{ email: string; userId: string; userName: string }>;
  activity?: {
    id: string;
    title: string;
    titleEn: string | null;
    eligibleStatuses: string[];
    eligibleCount: number;
    alreadyIssuedCount: number;
    users: Array<{ userId: string; email: string; name: string; state: "ok" | "existing_issue"; issueId?: string; verificationCode?: string }>;
  };
  summary?: { total: number; valid: number; malformed: number; duplicates: number; existingIssues: number };
};

export type CreateCertificateBatchInput = {
  idempotencyKey: string;
  source: CertificateBatchSourceValue;
  templateId: string;
  recipients?: string;
  activityId?: string;
  issueDate?: string;
  variableValues?: Record<string, unknown>;
  notify?: boolean;
  createdByUserId: string;
};

export type ProcessChunkResult = {
  ok: boolean;
  error?: string;
  batch: Awaited<ReturnType<typeof getCertificateBatchDetail>>["batch"] | null;
  processedItems: Array<{ id: string; email: string; status: string; error?: string | null; certificateIssueId?: string | null }>;
};

export function sourceIdForBatchItem(itemId: string) {
  return `${CERTIFICATE_BATCH_ITEM_SOURCE_ID_PREFIX}${itemId}`;
}

export function parseCertificateBatchRecipients(raw: string) {
  const rows: ParsedRecipientRow[] = [];
  const seen = new Set<string>();
  const parts = raw.split(/[\n,;，；]+/).map((part) => part.trim()).filter(Boolean);

  parts.forEach((part, index) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(part)) {
      rows.push({ row: index + 1, raw: part, state: "malformed" });
      return;
    }

    const email = normalizeUserEmail(part);
    if (seen.has(email)) {
      rows.push({ row: index + 1, raw: part, state: "duplicate", email });
      return;
    }

    seen.add(email);
    rows.push({ row: index + 1, raw: part, state: "ok", email });
  });

  return rows;
}

async function findActiveDefinition(prisma: PrismaClient, templateId: string) {
  return prisma.certificateDefinition.findFirst({
    where: { templateId, isActive: true, category: { isActive: true }, template: { isActive: true } },
    select: {
      id: true,
      name: true,
      nameEn: true,
      templateId: true,
      template: { select: { id: true, renderConfigJson: true, version: true, isActive: true } },
      category: { select: { name: true, nameEn: true, isActive: true } },
    },
  });
}

async function resolveActivityEligibleUsers(prisma: PrismaClient, activityId: string, definitionId: string) {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { id: true, title: true, titleEn: true },
  });
  if (!activity) {
    return { ok: false as const, error: "Activity not found." };
  }

  const participations = await prisma.activityParticipation.findMany({
    where: {
      activityId,
      status: { in: [...ACTIVITY_ELIGIBLE_PARTICIPATION_STATUSES] },
    },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });

  const userIds = [...new Set(participations.map((participation) => participation.userId))];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, email: true, name: true },
      })
    : [];

  if (users.length === 0) {
    return { ok: true as const, activity, users: [], existingIssues: new Map<string, { id: string; verificationCode: string | null }>() };
  }

  const issues = await prisma.certificateIssue.findMany({
    where: {
      definitionId,
      userId: { in: users.map((user) => user.id) },
    },
    select: { id: true, userId: true, verificationCode: true },
  });
  const existingIssues = new Map(issues.map((issue) => [issue.userId, { id: issue.id, verificationCode: issue.verificationCode }]));

  return { ok: true as const, activity, users, existingIssues };
}

export async function preflightCertificateBatch(
  prisma: PrismaClient,
  input: { templateId: string; source: CertificateBatchSourceValue; recipients?: string; activityId?: string },
): Promise<PreflightReport> {
  const definition = await findActiveDefinition(prisma, input.templateId);
  if (!definition) {
    return { ok: false, error: "No active certificate definition found for this template." };
  }

  if (input.source === "ACTIVITY_ELIGIBLE_LIST") {
    if (!input.activityId) {
      return { ok: false, error: "An activity must be selected for the eligible-list source." };
    }

    const resolved = await resolveActivityEligibleUsers(prisma, input.activityId, definition.id);
    if (!resolved.ok) {
      return { ok: false, error: resolved.error };
    }

    const users = resolved.users.map((user) => {
      const existing = resolved.existingIssues.get(user.id);
      return {
        userId: user.id,
        email: user.email,
        name: user.name,
        state: existing ? "existing_issue" as const : "ok" as const,
        ...(existing ? { issueId: existing.id, verificationCode: existing.verificationCode ?? undefined } : {}),
      };
    });

    return {
      ok: true,
      templateId: definition.templateId,
      definitionId: definition.id,
      definitionName: definition.nameEn ?? definition.name,
      recipients: users.filter((user) => user.state === "ok").map((user) => ({ email: user.email, userId: user.userId, userName: user.name })),
      activity: {
        id: resolved.activity.id,
        title: resolved.activity.title,
        titleEn: resolved.activity.titleEn,
        eligibleStatuses: [...ACTIVITY_ELIGIBLE_PARTICIPATION_STATUSES],
        eligibleCount: users.length,
        alreadyIssuedCount: users.filter((user) => user.state === "existing_issue").length,
        users,
      },
      summary: {
        total: users.length,
        valid: users.filter((user) => user.state === "ok").length,
        malformed: 0,
        duplicates: 0,
        existingIssues: users.filter((user) => user.state === "existing_issue").length,
      },
    };
  }

  if (input.source !== "MANUAL_LIST" && input.source !== "CSV") {
    return { ok: false, error: "Unsupported batch source." };
  }

  const rows = parseCertificateBatchRecipients(input.recipients ?? "");
  const emails = rows.filter((row) => row.state === "ok" && row.email).map((row) => row.email!);

  if (emails.length > 0) {
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true, name: true },
    });
    const userByEmail = new Map(users.map((user) => [normalizeUserEmail(user.email), user]));

    const issues = await prisma.certificateIssue.findMany({
      where: {
        definitionId: definition.id,
        userId: { in: users.map((user) => user.id) },
      },
      select: { id: true, userId: true, verificationCode: true },
    });
    const issueByUserId = new Map(issues.map((issue) => [issue.userId, issue]));

    for (const row of rows) {
      if (row.state !== "ok" || !row.email) {
        continue;
      }
      const user = userByEmail.get(row.email);
      if (!user) {
        continue;
      }
      row.userId = user.id;
      row.userName = user.name;
      const existing = issueByUserId.get(user.id);
      if (existing) {
        row.state = "existing_issue";
        row.issueId = existing.id;
        row.verificationCode = existing.verificationCode ?? undefined;
      }
    }
  }

  const summary = {
    total: rows.length,
    valid: rows.filter((row) => row.state === "ok").length,
    malformed: rows.filter((row) => row.state === "malformed").length,
    duplicates: rows.filter((row) => row.state === "duplicate").length,
    existingIssues: rows.filter((row) => row.state === "existing_issue").length,
  };

  return {
    ok: true,
    templateId: definition.templateId,
    definitionId: definition.id,
    definitionName: definition.nameEn ?? definition.name,
    rows,
    recipients: rows
      .filter((row) => row.state === "ok" && row.email && row.userId)
      .map((row) => ({ email: row.email!, userId: row.userId!, userName: row.userName ?? row.email! })),
    summary,
  };
}

export async function createCertificateBatch(prisma: PrismaClient, input: CreateCertificateBatchInput) {
  const idempotencyKey = input.idempotencyKey.trim();
  if (!idempotencyKey || idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    return { ok: false as const, status: 400, error: "A batch idempotency key is required." };
  }

  const existing = await prisma.certificateBatch.findUnique({
    where: { idempotencyKey },
    select: { id: true },
  });
  if (existing) {
    const detail = await getCertificateBatchDetail(prisma, existing.id);
    return { ok: true as const, status: 200, replayed: true, batch: detail.batch, items: detail.items };
  }

  const definition = await findActiveDefinition(prisma, input.templateId);
  if (!definition) {
    return { ok: false as const, status: 404, error: "No active certificate definition found for this template." };
  }

  let issuedAt: Date | null = null;
  if (input.issueDate) {
    const parsed = new Date(input.issueDate);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false as const, status: 400, error: "Invalid issue date." };
    }
    issuedAt = parsed;
  }

  const variableValues = normalizeManualVariableValues(input.variableValues);

  let items: Array<{ rowIndex: number; email: string; normalizedEmail: string }> = [];
  let activityId: string | null = null;

  if (input.source === "ACTIVITY_ELIGIBLE_LIST") {
    if (!input.activityId) {
      return { ok: false as const, status: 400, error: "An activity must be selected for the eligible-list source." };
    }
    const resolved = await resolveActivityEligibleUsers(prisma, input.activityId, definition.id);
    if (!resolved.ok) {
      return { ok: false as const, status: 404, error: resolved.error };
    }
    activityId = resolved.activity.id;
    items = resolved.users
      .filter((user) => !resolved.existingIssues.has(user.id))
      .slice(0, MAX_BATCH_RECIPIENTS)
      .map((user, index) => ({ rowIndex: index + 1, email: user.email, normalizedEmail: normalizeUserEmail(user.email) }));
  } else if (input.source === "MANUAL_LIST" || input.source === "CSV") {
    const rows = parseCertificateBatchRecipients(input.recipients ?? "");
    items = rows
      .filter((row) => row.state === "ok" && row.email)
      .slice(0, MAX_BATCH_RECIPIENTS)
      .map((row, index) => ({ rowIndex: index + 1, email: row.email!, normalizedEmail: normalizeUserEmail(row.email!) }));
  } else {
    return { ok: false as const, status: 400, error: "Unsupported batch source." };
  }

  if (items.length === 0) {
    return { ok: false as const, status: 400, error: "The batch has no valid recipients. Run the preflight check first." };
  }

  try {
    const created = await prisma.certificateBatch.create({
      data: {
        idempotencyKey,
        source: input.source,
        status: "PENDING",
        templateId: definition.templateId,
        definitionId: definition.id,
        activityId,
        issueDate: issuedAt,
        variableValuesJson: variableValues as object,
        notifyRecipients: input.notify ?? true,
        totalCount: items.length,
        createdByUserId: input.createdByUserId,
        items: { create: items },
      },
      select: { id: true },
    });

    await writeBatchAudit(prisma, input.createdByUserId, "certificate.batch_created", created.id, "created", {
      source: input.source,
      templateId: definition.templateId,
      definitionId: definition.id,
      activityId,
      totalCount: items.length,
      notifyRecipients: input.notify ?? true,
    });

    const detail = await getCertificateBatchDetail(prisma, created.id);
    return { ok: true as const, status: 201, replayed: false, batch: detail.batch, items: detail.items };
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "P2002") {
      const replay = await prisma.certificateBatch.findUnique({ where: { idempotencyKey }, select: { id: true } });
      if (replay) {
        const detail = await getCertificateBatchDetail(prisma, replay.id);
        return { ok: true as const, status: 200, replayed: true, batch: detail.batch, items: detail.items };
      }
    }
    throw error;
  }
}

export async function getCertificateBatchDetail(prisma: PrismaClient, batchId: string) {
  const [batch, items] = await Promise.all([
    prisma.certificateBatch.findUnique({
      where: { id: batchId },
      include: {
        definition: {
          select: {
            id: true,
            name: true,
            nameEn: true,
            templateId: true,
            category: { select: { name: true, nameEn: true } },
          },
        },
        template: { select: { id: true, renderConfigJson: true, version: true } },
        activity: { select: { id: true, title: true, titleEn: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.certificateBatchItem.findMany({
      where: { batchId },
      orderBy: { rowIndex: "asc" },
      take: 500,
      select: {
        id: true,
        rowIndex: true,
        email: true,
        normalizedEmail: true,
        status: true,
        attempts: true,
        certificateIssueId: true,
        error: true,
        updatedAt: true,
        certificateIssue: { select: { id: true, verificationCode: true, status: true, generatedFileName: true } },
      },
    }),
  ]);

  if (!batch) {
    return { batch: null, items: [] as typeof items };
  }

  return { batch, items };
}

export async function listCertificateBatches(prisma: PrismaClient, limit = 10) {
  const batches = await prisma.certificateBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(50, Math.max(1, limit)),
    include: {
      definition: { select: { id: true, name: true, nameEn: true } },
      template: { select: { id: true, name: true, nameEn: true } },
      activity: { select: { id: true, title: true, titleEn: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  return { batches };
}

async function writeBatchAudit(
  prisma: PrismaClient,
  actorUserId: string,
  action: string,
  batchId: string,
  result: string,
  metadataJson: Record<string, unknown>,
) {
  await prisma.coreAuditLog.create({
    data: {
      actorUserId,
      action,
      subjectType: "certificate_batch",
      subjectId: batchId,
      result,
      metadataJson: metadataJson as object,
    },
  });
}

function claimEligibilityWhere(onlyFailed: boolean, now: Date) {
  if (onlyFailed) {
    return { status: "FAILED" as const };
  }
  return {
    OR: [
      { status: "PENDING" as const },
      { status: "FAILED" as const },
      { status: "PROCESSING" as const, leaseExpiresAt: { lt: now } },
    ],
  };
}

async function claimBatchItems(prisma: PrismaClient, batchId: string, limit: number, onlyFailed: boolean, now: Date) {
  const leaseUntil = new Date(now.getTime() + BATCH_ITEM_LEASE_MS);
  const candidates = await prisma.certificateBatchItem.findMany({
    where: { batchId, ...claimEligibilityWhere(onlyFailed, now) },
    orderBy: { rowIndex: "asc" },
    take: limit,
    select: { id: true },
  });

  const claimed: string[] = [];
  for (const candidate of candidates) {
    // Per-item compare-and-set claim: only one concurrent caller can move the item
    // back to PROCESSING, so two overlapping process/retry calls never share an item.
    const result = await prisma.certificateBatchItem.updateMany({
      where: { id: candidate.id, ...claimEligibilityWhere(onlyFailed, now) },
      data: { status: "PROCESSING", leaseExpiresAt: leaseUntil, attempts: { increment: 1 } },
    });
    if (result.count === 1) {
      claimed.push(candidate.id);
    }
  }

  return claimed;
}

async function markItemFailed(prisma: PrismaClient, itemId: string, error: string) {
  await prisma.certificateBatchItem.updateMany({
    where: { id: itemId, status: "PROCESSING" },
    data: { status: "FAILED", error: error.slice(0, 500), leaseExpiresAt: null },
  });
}

async function finalizeSucceededItem(
  prisma: PrismaClient,
  batch: { id: string; notifyRecipients: boolean; createdByUserId: string },
  item: { id: string; rowIndex: number; normalizedEmail: string },
  issue: { id: string },
  recipientUserId: string,
  actorUserId: string,
  metadata: { reconciled: boolean },
) {
  await prisma.$transaction(async (tx) => {
    // The compare-and-set on the claimed item state makes this transition happen at
    // most once, which is what guarantees the exactly-one in-app notification below.
    const cas = await tx.certificateBatchItem.updateMany({
      where: { id: item.id, status: "PROCESSING" },
      data: { status: "SUCCEEDED", certificateIssueId: issue.id, error: null, leaseExpiresAt: null },
    });
    if (cas.count === 0) {
      return;
    }

    if (batch.notifyRecipients) {
      await tx.notification.create({
        data: {
          userId: recipientUserId,
          kind: "CERTIFICATE",
          title: "Certificate issued",
          body: "Your certificate has been issued and is ready to view.",
          actionUrl: "/certificates",
          metadata: { sourceType: CERTIFICATE_BATCH_SOURCE_TYPE, batchId: batch.id, batchItemId: item.id },
        },
      });
    }

    await tx.coreAuditLog.create({
      data: {
        actorUserId,
        action: "certificate.batch_item_issued",
        subjectType: "certificate_batch_item",
        subjectId: item.id,
        result: "issued",
        metadataJson: {
          batchId: batch.id,
          rowIndex: item.rowIndex,
          recipientEmail: item.normalizedEmail,
          issueId: issue.id,
          reconciled: metadata.reconciled,
        } as object,
      },
    });
  });
}

async function processBatchItem(
  prisma: PrismaClient,
  batch: {
    id: string;
    notifyRecipients: boolean;
    createdByUserId: string;
    issueDate: Date | null;
    variableValuesJson: unknown;
    definition: {
      id: string;
      name: string;
      nameEn: string | null;
      templateId: string;
      category: { name: string; nameEn: string | null };
    };
    template: { renderConfigJson: unknown; version: number };
    createdBy: { id: string; name: string };
  },
  item: {
    id: string;
    rowIndex: number;
    email: string;
    normalizedEmail: string;
    attempts: number;
  },
  actorUserId: string,
  verificationUrlBase: string,
) {
  const sourceId = sourceIdForBatchItem(item.id);

  // Reconcile the failure window where a previous attempt created the certificate
  // issue but did not finish updating the item: link the existing issue instead of
  // issuing a second certificate for the same recipient.
  const existingIssue = await prisma.certificateIssue.findFirst({
    where: { sourceType: CERTIFICATE_BATCH_SOURCE_TYPE, sourceId },
    select: { id: true, userId: true, verificationCode: true, generatedFileName: true },
  });
  if (existingIssue) {
    await finalizeSucceededItem(prisma, batch, item, existingIssue, existingIssue.userId, actorUserId, { reconciled: true });
    try {
      await createAchievementRecord({
        userId: existingIssue.userId,
        name: batch.definition.nameEn ?? batch.definition.name,
        description: `Certificate issued: ${batch.definition.category.nameEn ?? batch.definition.category.name}`,
        type: "VERIFIED",
        sourceType: "CERTIFICATE_ISSUED",
        sourceId: `certificate:${existingIssue.id}`,
        verificationLevel: "INSTITUTION_VERIFIED",
        points: 80,
        relatedCertificateId: existingIssue.id,
        completedAt: batch.issueDate ?? new Date(),
        skillTags: ["certificate"],
        topicTags: [batch.definition.category.nameEn ?? batch.definition.category.name],
        sdgTags: ["SDG13"],
      });
    } catch (achievementError) {
      console.error("[certificate.batch] reconcile achievement write failed:", achievementError instanceof Error ? achievementError.message : String(achievementError));
    }
    return { ok: true as const, itemId: item.id, email: item.normalizedEmail, status: "SUCCEEDED", certificateIssueId: existingIssue.id, reconciled: true };
  }

  const issuedAt = batch.issueDate ?? new Date();
  const result = await issueCertificateToRecipient(prisma, {
    email: item.normalizedEmail,
    certificateDefinition: {
      id: batch.definition.id,
      name: batch.definition.name,
      nameEn: batch.definition.nameEn,
      category: { name: batch.definition.category.name, nameEn: batch.definition.category.nameEn },
      templateId: batch.definition.templateId,
      template: {
        renderConfigJson: batch.template.renderConfigJson,
        version: batch.template.version,
      },
    },
    adminUser: { id: batch.createdBy.id, name: batch.createdBy.name },
    issuedAt,
    manualVariableValues: normalizeManualVariableValues(batch.variableValuesJson as Record<string, unknown> | undefined),
    verificationUrlBase,
    sourceType: CERTIFICATE_BATCH_SOURCE_TYPE,
    sourceId,
    auditAction: "certificate.batch_item_issued",
    auditMetadata: { batchId: batch.id, batchItemId: item.id, rowIndex: item.rowIndex },
  });

  if (!result.ok) {
    await markItemFailed(prisma, item.id, result.error);
    return { ok: false as const, itemId: item.id, email: item.normalizedEmail, status: "FAILED", error: result.error };
  }

  await finalizeSucceededItem(
    prisma,
    batch,
    item,
    { id: result.issueId },
    result.recipient.id,
    actorUserId,
    { reconciled: false },
  );

  return { ok: true as const, itemId: item.id, email: item.normalizedEmail, status: "SUCCEEDED", certificateIssueId: result.issueId, reconciled: false };
}

async function refreshBatchState(prisma: PrismaClient, batchId: string, actorUserId: string) {
  const counts = await prisma.certificateBatchItem.groupBy({
    by: ["status"],
    where: { batchId },
    _count: { _all: true },
  });

  const countByStatus: Record<string, number> = {};
  for (const entry of counts) {
    countByStatus[entry.status] = entry._count._all;
  }

  const total = counts.reduce((sum, entry) => sum + entry._count._all, 0);
  const succeeded = countByStatus.SUCCEEDED ?? 0;
  const failed = countByStatus.FAILED ?? 0;
  const inFlight = (countByStatus.PENDING ?? 0) + (countByStatus.PROCESSING ?? 0);

  let status = "PROCESSING";
  if (total > 0 && succeeded === total) {
    status = "COMPLETED";
  } else if (total > 0 && failed === total) {
    status = "FAILED";
  } else if (inFlight === total) {
    status = "PENDING";
  } else if (inFlight === 0) {
    status = "COMPLETED_WITH_FAILURES";
  }

  const previous = await prisma.certificateBatch.findUnique({ where: { id: batchId }, select: { status: true } });
  const becameTerminal = ["COMPLETED", "COMPLETED_WITH_FAILURES", "FAILED"].includes(status)
    && !["COMPLETED", "COMPLETED_WITH_FAILURES", "FAILED"].includes(previous?.status ?? "");

  await prisma.certificateBatch.update({
    where: { id: batchId },
    data: {
      status: status as "PENDING" | "PROCESSING" | "COMPLETED" | "COMPLETED_WITH_FAILURES" | "FAILED",
      totalCount: total,
      succeededCount: succeeded,
      failedCount: failed,
      completedAt: becameTerminal ? new Date() : undefined,
    },
  });

  if (becameTerminal) {
    await writeBatchAudit(prisma, actorUserId, "certificate.batch_completed", batchId, status.toLowerCase(), {
      totalCount: total,
      succeededCount: succeeded,
      failedCount: failed,
    });
  }
}

export async function processCertificateBatchChunk(
  prisma: PrismaClient,
  input: { batchId: string; limit?: number; onlyFailed?: boolean; actorUserId: string; verificationUrlBase: string },
): Promise<ProcessChunkResult> {
  const limit = Math.min(MAX_CHUNK_SIZE, Math.max(1, input.limit ?? DEFAULT_CHUNK_SIZE));
  const detail = await getCertificateBatchDetail(prisma, input.batchId);
  if (!detail.batch) {
    return { ok: false, error: "Batch not found.", batch: null, processedItems: [] };
  }
  const batch = detail.batch;
  const isTerminal = ["COMPLETED", "COMPLETED_WITH_FAILURES", "FAILED"].includes(batch.status);
  // A batch that finished with failures stays retryable: the retry-failed flow claims
  // FAILED items again instead of treating the terminal state as immutable.
  if (isTerminal && (!input.onlyFailed || batch.failedCount === 0)) {
    return { ok: true, batch: detail.batch, processedItems: [] };
  }

  const now = new Date();
  const claimedIds = await claimBatchItems(prisma, batch.id, limit, input.onlyFailed ?? false, now);
  const claimedItems = claimedIds.length
    ? await prisma.certificateBatchItem.findMany({
        where: { id: { in: claimedIds } },
        orderBy: { rowIndex: "asc" },
      })
    : [];
  const processedItems: ProcessChunkResult["processedItems"] = [];

  for (const item of claimedItems) {
    try {
      const outcome = await processBatchItem(prisma, batch, item, input.actorUserId, input.verificationUrlBase);
      processedItems.push({
        id: outcome.itemId,
        email: outcome.email,
        status: outcome.status,
        ...(outcome.ok ? { certificateIssueId: outcome.certificateIssueId } : { error: outcome.error }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await markItemFailed(prisma, item.id, `Certificate issuance failed: ${message}`.slice(0, 500));
      processedItems.push({ id: item.id, email: item.normalizedEmail, status: "FAILED", error: message });
    }
  }

  await refreshBatchState(prisma, batch.id, input.actorUserId);

  await writeBatchAudit(prisma, input.actorUserId, input.onlyFailed ? "certificate.batch_retry" : "certificate.batch_processed", batch.id, "processed", {
    claimedCount: claimedIds.length,
    onlyFailed: input.onlyFailed ?? false,
  });

  const refreshed = await getCertificateBatchDetail(prisma, batch.id);
  return { ok: true, batch: refreshed.batch, processedItems };
}
