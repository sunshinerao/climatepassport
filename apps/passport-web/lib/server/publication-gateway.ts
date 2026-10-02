import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { resolveConsent } from "./consents";
import { resolveRecordAccess, type PrivateRecordError } from "./private-records";
import { findAuthoritativeReceipt, PUBLICATION_APPROVAL_PURPOSE } from "./external-decision-receipts";
import { enqueueOutboundDispatch, findDispatchTargets } from "./reliable-dispatch";
import { resolveScopedAccess } from "./programme-scope";

/**
 * CP-TODO-251：按版本发布/撤回与 fail-closed 公开读门（CP-FR-061/068）。
 *
 * 原则：
 * - 只发布获批版本：可选 approvalReceipt 强制要求对象存在该版本及以上的
 *   APPROVED 外部决定回执（CP-TODO-250）；作者意愿/审核/发布/频道/许可相互独立。
 * - 版本即不可变投影：(objectType, objectId, version) 唯一；同版本同内容幂等，
 *   同版本异内容 409；发布新版不下架仍有效的旧版；新版待审不泄漏（读门只返回
 *   PUBLISHED 且未撤回版本）。
 * - 撤回立即生效且不可恢复：已撤回版本禁止重新发布（必须发新版本），并发/乱序
 *   操作不能复活已撤回内容。
 * - 发布前同意门：必要权利人的目的同意须有效（撤回/过期即阻断，CP-FR-060）。
 * - 发布/撤回在同一事务内向订阅频道（dispatch:publications 的已登记 MACHINE
 *   客户端）入队可靠出站事件；payload 只含定位信息与版本，不含私密正文。
 * - 关键写入与审计同一事务提交（CP-AUD-005）。
 */

export type PublicationError = PrivateRecordError;

type PrismaLike = Pick<PrismaClient,
  | "publicationProjection"
  | "scopedRecord"
  | "recordRevision"
  | "objectAuthorization"
  | "programme"
  | "edition"
  | "accessMembership"
  | "institutionRepresentation"
  | "sourceObjectMapping"
  | "externalDecisionReceipt"
  | "consentRecord"
  | "channelClient"
  | "outboundDispatch"
  | "user"
  | "coreAuditLog"> & {
    $transaction: PrismaClient["$transaction"];
  };

function publicationError(error: string, status: number, code: string): PublicationError {
  return { error, status, code };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function hashProjectionJson(projectionJson: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(projectionJson))).digest("hex");
}

export const PUBLICATION_FANOUT_SCOPE = "dispatch:publications";

/** 发布权限：scoped_record 的所有者/授权/Programme manage；其他对象须 Programme manage。 */
async function resolvePublicationAccess(
  prisma: PrismaLike,
  input: { objectType: string; objectId: string; actorUserId: string; programmeId?: string | null },
): Promise<{ granted: boolean }> {
  if (input.objectType === "scoped_record") {
    const record = await prisma.scopedRecord.findUnique({
      where: { id: input.objectId },
      select: { id: true, ownerUserId: true, programmeId: true, status: true },
    });
    if (!record) return { granted: false };
    const access = await resolveRecordAccess(prisma, record, input.actorUserId, "manage");
    return { granted: access.granted };
  }
  if (input.programmeId) {
    const decision = await resolveScopedAccess(
      prisma,
      { id: input.actorUserId },
      { programmeId: input.programmeId },
      "manage",
      null,
    );
    return { granted: decision.allowed };
  }
  return { granted: false };
}

/** 同意门：逐条要求解析有效同意；区分从未授予与已撤回。 */
async function assertConsentRequirements(
  prisma: PrismaLike,
  requirements: Array<{ subjectUserId: string; purpose: string }>,
  channel: string | null,
  objectType: string,
  objectId: string,
): Promise<PublicationError | null> {
  for (const requirement of requirements) {
    const { consent } = await resolveConsent(prisma, {
      subjectUserId: requirement.subjectUserId,
      purpose: requirement.purpose,
      channel,
      objectType,
      objectId,
    });
    if (!consent) {
      const withdrawn = await prisma.consentRecord.findFirst({
        where: {
          subjectUserId: requirement.subjectUserId,
          purpose: requirement.purpose,
          status: "WITHDRAWN",
          OR: [{ channel: null }, ...(channel ? [{ channel }] : [])],
        },
        select: { id: true },
        orderBy: { version: "desc" },
      });
      return publicationError(
        withdrawn ? "A required consent was withdrawn." : "A required consent is missing.",
        403,
        withdrawn ? "CONSENT_WITHDRAWN" : "CONSENT_REQUIRED",
      );
    }
  }
  return null;
}

export interface PublishInput {
  actorUserId: string;
  objectType: string;
  objectId: string;
  version: number;
  projectionJson: Record<string, unknown>;
  channel?: string | null;
  license?: string | null;
  programmeId?: string | null;
  consentRequirements?: Array<{ subjectUserId: string; purpose: string }>;
  /** 强制外部批准回执门：要求对象存在 >= version 的 APPROVED 回执（只发布批准版本）。 */
  approvalReceipt?: boolean;
}

/** 发布（或幂等重发）一个不可见投影版本。 */
export async function publishProjection(
  prisma: PrismaLike,
  input: PublishInput,
): Promise<{ publicationId: string; deduplicated: boolean } | PublicationError> {
  if (input.version < 1) return publicationError("version must be >= 1.", 400, "INVALID_REQUEST");

  const access = await resolvePublicationAccess(prisma, input);
  if (!access.granted) return publicationError("Forbidden", 403, "RECORD_ACCESS_DENIED");

  const contentHash = hashProjectionJson(input.projectionJson);
  const existing = await prisma.publicationProjection.findUnique({
    where: {
      objectType_objectId_version: {
        objectType: input.objectType,
        objectId: input.objectId,
        version: input.version,
      },
    },
  });
  if (existing) {
    if (existing.status === "WITHDRAWN") {
      return publicationError("This version was withdrawn and cannot be republished; publish a new version.", 409, "PUBLICATION_RESTORE_FORBIDDEN");
    }
    const existingHash = hashProjectionJson(existing.projectionJson as Record<string, unknown>);
    if (existingHash === contentHash) return { publicationId: existing.id, deduplicated: true };
    return publicationError("A different projection for this version is already published.", 409, "PUBLICATION_CONFLICT");
  }

  if (input.approvalReceipt) {
    const { receipt } = await findAuthoritativeReceipt(prisma, {
      objectType: input.objectType,
      objectId: input.objectId,
      purpose: PUBLICATION_APPROVAL_PURPOSE,
      minRevision: input.version,
    });
    if (!receipt) {
      return publicationError("An approved external decision receipt for this version is required.", 403, "RECEIPT_ISSUER_UNVERIFIED");
    }
  }

  const consentFailure = await assertConsentRequirements(
    prisma,
    input.consentRequirements ?? [],
    input.channel ?? null,
    input.objectType,
    input.objectId,
  );
  if (consentFailure) return consentFailure;

  const targets = await findDispatchTargets(prisma, PUBLICATION_FANOUT_SCOPE);

  try {
    return await prisma.$transaction(async (tx) => {
      const publication = await tx.publicationProjection.create({
        data: {
          objectType: input.objectType,
          objectId: input.objectId,
          version: input.version,
          projectionJson: input.projectionJson as Prisma.InputJsonValue,
          status: "PUBLISHED",
          publishedById: input.actorUserId,
        },
        select: { id: true },
      });
      const publishedAt = new Date();
      for (const target of targets) {
        await enqueueOutboundDispatch(tx, {
          eventType: "publication.published",
          idempotencyKey: `publication:${input.objectType}:${input.objectId}:${input.version}:published:${target.id}`,
          payload: {
            objectType: input.objectType,
            objectId: input.objectId,
            version: input.version,
            channel: input.channel ?? null,
            license: input.license ?? null,
            status: "PUBLISHED",
            publishedAt: publishedAt.toISOString(),
            projectionHash: contentHash,
          },
          revision: input.version,
          channelClientId: target.id,
        });
      }
      await tx.coreAuditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "publication.publish",
          subjectType: input.objectType,
          subjectId: input.objectId,
          result: "published",
          metadataJson: { publicationId: publication.id, version: input.version, channel: input.channel ?? null },
        },
      });
      return { publicationId: publication.id, deduplicated: false };
    });
  } catch (error) {
    console.error("publication publish failed:", error);
    return publicationError("Publish failed. No state was changed.", 500, "INTERNAL_ERROR");
  }
}

/** 撤回：立即生效；只影响指定版本，并发/乱序不能恢复或波及其他版本。 */
export async function withdrawProjection(
  prisma: PrismaLike,
  input: {
    actorUserId: string;
    objectType: string;
    objectId: string;
    version: number;
    programmeId?: string | null;
  },
): Promise<{ publicationId: string } | PublicationError> {
  const access = await resolvePublicationAccess(prisma, input);
  if (!access.granted) return publicationError("Forbidden", 403, "RECORD_ACCESS_DENIED");

  const existing = await prisma.publicationProjection.findUnique({
    where: {
      objectType_objectId_version: {
        objectType: input.objectType,
        objectId: input.objectId,
        version: input.version,
      },
    },
    select: { id: true, status: true },
  });
  if (!existing) return publicationError("Publication not found.", 404, "PUBLICATION_NOT_FOUND");

  const targets = await findDispatchTargets(prisma, PUBLICATION_FANOUT_SCOPE);

  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.publicationProjection.updateMany({
        where: {
          objectType: input.objectType,
          objectId: input.objectId,
          version: input.version,
          status: "PUBLISHED",
        },
        data: { status: "WITHDRAWN", withdrawnAt: new Date(), withdrawnById: input.actorUserId },
      });
      if (updated.count !== 1) {
        // 已撤回版本再撤回视为幂等成功（读门对已撤回一律 404）。
        return { publicationId: existing.id };
      }
      const withdrawnAt = new Date();
      for (const target of targets) {
        await enqueueOutboundDispatch(tx, {
          eventType: "publication.withdrawn",
          idempotencyKey: `publication:${input.objectType}:${input.objectId}:${input.version}:withdrawn:${target.id}`,
          payload: {
            objectType: input.objectType,
            objectId: input.objectId,
            version: input.version,
            status: "WITHDRAWN",
            withdrawnAt: withdrawnAt.toISOString(),
          },
          revision: input.version,
          channelClientId: target.id,
        });
      }
      await tx.coreAuditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "publication.withdraw",
          subjectType: input.objectType,
          subjectId: input.objectId,
          result: "withdrawn",
          metadataJson: { publicationId: existing.id, version: input.version },
        },
      });
      return { publicationId: existing.id };
    });
  } catch (error) {
    console.error("publication withdraw failed:", error);
    return publicationError("Withdraw failed. No state was changed.", 500, "INTERNAL_ERROR");
  }
}

/** 公开读门：fail-closed；只返回 PUBLISHED 且未撤回版本；默认取最新已发布版本。 */
export async function readPublishedProjection(
  prisma: Pick<PrismaClient, "publicationProjection">,
  input: { objectType: string; objectId: string; version?: number },
): Promise<{ publication: Record<string, unknown> | null }> {
  const publication = input.version
    ? await prisma.publicationProjection.findUnique({
        where: {
          objectType_objectId_version: {
            objectType: input.objectType,
            objectId: input.objectId,
            version: input.version,
          },
        },
      })
    : await prisma.publicationProjection.findFirst({
        where: { objectType: input.objectType, objectId: input.objectId, status: "PUBLISHED" },
        orderBy: { version: "desc" },
      });
  if (!publication || publication.status !== "PUBLISHED") return { publication: null };
  return { publication: publication as unknown as Record<string, unknown> };
}

/** 管理端列表。 */
export async function listPublications(
  prisma: Pick<PrismaClient, "publicationProjection">,
  input: { objectType?: string; objectId?: string; status?: string; take?: number },
): Promise<{ publications: Array<Record<string, unknown>> }> {
  const publications = await prisma.publicationProjection.findMany({
    where: {
      ...(input.objectType ? { objectType: input.objectType } : {}),
      ...(input.objectId ? { objectId: input.objectId } : {}),
      ...(input.status ? { status: input.status } : {}),
    },
    orderBy: [{ objectType: "asc" }, { objectId: "asc" }, { version: "desc" }],
    take: input.take ?? 100,
  });
  return { publications: publications as unknown as Array<Record<string, unknown>> };
}
