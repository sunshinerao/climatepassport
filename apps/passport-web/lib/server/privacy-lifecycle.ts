/**
 * CP-TODO-257：本人导出、账户删除与备份隐私标记回放（CP-FR-068）。
 *
 * 原则：
 * - 三个动作分开：导出（读取副本）、撤回（对象级 WITHDRAWN）、删除（账户匿名化）。
 * - 导出仅本人有权材料及索引：本人拥有的记录带正文，他人授予的权利只出索引条目，
 *   绝不携带其他作者的私密内容。
 * - 删除覆盖衍生/索引并说明受限保留：匿名化 User/Person，撤回本人 ACTIVE 记录，
 *   会话吊销；审计、凭证签发历史等受限保留类别在返回的 retentionNotice 中明示。
 * - 恢复先重放撤回/删除标记再开放读取：所有撤回/删除动作落 append-only
 *   privacy_markers；备份恢复后 replayPrivacyMarkers 幂等重放标记，之后才开放读取。
 */

import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

export type PrivacyError = { error: string; status: number; code: string };

export function privacyError(status: number, code: string, error: string): PrivacyError {
  return { error, status, code };
}

type PrismaLike = Pick<
  PrismaClient,
  | "user"
  | "session"
  | "person"
  | "scopedRecord"
  | "consentRecord"
  | "controlledAsset"
  | "contributionFact"
  | "objectAuthorization"
  | "privacyMarker"
  | "coreAuditLog"
> & { $transaction: PrismaClient["$transaction"] };

export const PRIVACY_MARKER_ACTIONS = ["WITHDRAWN", "DELETED"] as const;

export async function recordPrivacyMarker(
  tx: Pick<PrismaClient, "privacyMarker">,
  input: {
    subjectType: string;
    subjectId: string;
    action: (typeof PRIVACY_MARKER_ACTIONS)[number];
    actorUserId?: string | null;
    reason?: string | null;
    metadataJson?: Prisma.InputJsonValue;
  }
) {
  await tx.privacyMarker.create({
    data: {
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      action: input.action,
      actorUserId: input.actorUserId ?? null,
      reason: input.reason ?? null,
      metadataJson: input.metadataJson ?? undefined,
    },
  });
}

export async function exportUserData(
  prisma: PrismaLike,
  input: { userId: string }
): Promise<{ export: Record<string, unknown> } | PrivacyError> {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) return privacyError(404, "NOTIFICATION_NOT_FOUND", "User not found");

  const person = await prisma.person.findUnique({ where: { userId: input.userId } });
  const records = await prisma.scopedRecord.findMany({ where: { ownerUserId: input.userId } });
  const grantsHeld = await prisma.objectAuthorization.findMany({ where: { subjectUserId: input.userId } });
  const consents = await prisma.consentRecord.findMany({ where: { subjectUserId: input.userId } });
  const assets = await prisma.controlledAsset.findMany({ where: { ownerUserId: input.userId } });
  const contributionFacts = person
    ? await prisma.contributionFact.findMany({ where: { personId: person.id } })
    : [];

  return {
    export: {
      exportedAt: new Date().toISOString(),
      profile: {
        email: user.anonymizedAt ? null : user.email,
        name: user.anonymizedAt ? null : user.name,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        anonymizedAt: user.anonymizedAt,
      },
      person: person
        ? {
            id: person.id,
            displayName: person.displayName,
            verificationStatus: person.verificationStatus,
          }
        : null,
      records: records.map((record) => ({
        recordId: record.id,
        recordType: record.recordType,
        title: record.title,
        status: record.status,
        currentRevision: record.currentRevision,
        payloadJson: record.payloadJson,
      })),
      grantedRecordIndex: grantsHeld.map((grant) => ({
        objectType: grant.objectType,
        objectId: grant.objectId,
        purpose: grant.purpose,
        validUntil: grant.validUntil,
      })),
      consents: consents.map((consent) => ({
        purpose: consent.purpose,
        channel: consent.channel,
        status: consent.status,
        version: consent.version,
        validFrom: consent.validFrom,
        validUntil: consent.validUntil,
      })),
      assetIndex: assets.map((asset) => ({
        assetId: asset.id,
        fileName: asset.fileName,
        contentType: asset.contentType,
        byteSize: asset.byteSize,
        sha256: asset.sha256,
        purpose: asset.purpose,
        status: asset.status,
      })),
      contributionFacts: contributionFacts.map((fact) => ({
        factId: fact.id,
        contributionType: fact.contributionType,
        verificationLevel: fact.verificationLevel,
        status: fact.status,
        summaryJson: fact.summaryJson,
      })),
      // 显式声明：导出不含其他作者拥有的记录正文或受控资产内容。
      otherAuthorsContentIncluded: false,
    },
  };
}

const RETENTION_NOTICE = [
  "core_audit_logs（操作审计，安全与合规受限保留）",
  "certificates / certificate_issues（已签发凭证历史，不可物理删除）",
  "activity_checkin_records 与活动参与历史（活动事实记录，保留聚合口径）",
  "receipts / dispatch 记录（跨系统对账证据）",
];

export async function deleteUserAccount(
  prisma: PrismaLike,
  input: { userId: string; reason: string }
): Promise<{ deleted: true; withdrawnRecords: number; retentionNotice: string[] } | PrivacyError> {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) return privacyError(404, "NOTIFICATION_NOT_FOUND", "User not found");
  if (user.anonymizedAt) return { deleted: true, withdrawnRecords: 0, retentionNotice: RETENTION_NOTICE };

  const result = await prisma.$transaction(async (tx) => {
    const anonymousEmail = `deleted-${createHash("sha256").update(input.userId).digest("hex").slice(0, 24)}@anonymized.invalid`;
    const anonymized = await tx.user.updateMany({
      where: { id: input.userId, anonymizedAt: null },
      data: {
        name: "Deleted user",
        email: anonymousEmail,
        password: createHash("sha256").update(`disabled-${input.userId}`).digest("hex"),
        salutation: null,
        avatar: null,
        phone: null,
        title: null,
        bio: null,
        country: null,
        resetToken: null,
        resetTokenExpiry: null,
        status: "SUSPENDED",
        anonymizedAt: new Date(),
        anonymizedReason: input.reason,
      },
    });
    if (anonymized.count !== 1) {
      throw new Error("account deletion lost a concurrent update");
    }

    await tx.session.deleteMany({ where: { userId: input.userId } });

    const person = await tx.person.findUnique({ where: { userId: input.userId } });
    if (person) {
      await tx.person.updateMany({
        where: { id: person.id },
        data: {
          displayName: "Deleted person",
          displayNameEn: null,
          salutation: null,
          title: null,
          titleEn: null,
          bio: null,
          bioEn: null,
          avatar: null,
          website: null,
          linkedin: null,
          twitter: null,
          orcid: null,
          countryOrRegion: null,
        },
      });
    }

    const owned = await tx.scopedRecord.findMany({ where: { ownerUserId: input.userId, status: "ACTIVE" } });
    for (const record of owned) {
      await tx.scopedRecord.updateMany({ where: { id: record.id, status: "ACTIVE" }, data: { status: "WITHDRAWN", withdrawnAt: new Date(), withdrawnById: input.userId } });
      await recordPrivacyMarker(tx, {
        subjectType: "ScopedRecord",
        subjectId: record.id,
        action: "WITHDRAWN",
        actorUserId: input.userId,
        reason: input.reason,
      });
    }

    await recordPrivacyMarker(tx, {
      subjectType: "User",
      subjectId: input.userId,
      action: "DELETED",
      actorUserId: input.userId,
      reason: input.reason,
    });
    await tx.coreAuditLog.create({
      data: {
        actorUserId: input.userId,
        action: "account.delete",
        subjectType: "User",
        subjectId: input.userId,
        result: "SUCCESS",
        metadataJson: { reason: input.reason, withdrawnRecords: owned.length },
      },
    });
    return { withdrawnRecords: owned.length };
  });

  return { deleted: true, withdrawnRecords: result.withdrawnRecords, retentionNotice: RETENTION_NOTICE };
}

/**
 * 备份恢复后重放隐私标记（幂等）：DELETED 用户重新匿名化，WITHDRAWN 记录重新置为
 * WITHDRAWN。先完成重放再开放读取；返回重放统计供运维对账。
 */
export async function replayPrivacyMarkers(
  prisma: PrismaLike,
  input: { subjectType?: string } = {}
): Promise<{ replayed: number; applied: number; skipped: number }> {
  const markers = await prisma.privacyMarker.findMany({
    where: input.subjectType ? { subjectType: input.subjectType } : {},
    orderBy: { createdAt: "asc" },
  });

  let applied = 0;
  let skipped = 0;
  for (const marker of markers) {
    if (marker.subjectType === "User" && marker.action === "DELETED") {
      const user = await prisma.user.findUnique({ where: { id: marker.subjectId } });
      if (!user || user.anonymizedAt) {
        skipped += 1;
        continue;
      }
      const anonymousEmail = `deleted-${createHash("sha256").update(marker.subjectId).digest("hex").slice(0, 24)}@anonymized.invalid`;
      await prisma.user.updateMany({
        where: { id: marker.subjectId },
        data: {
          name: "Deleted user",
          email: anonymousEmail,
          password: createHash("sha256").update(`disabled-${marker.subjectId}`).digest("hex"),
          salutation: null,
          avatar: null,
          phone: null,
          title: null,
          bio: null,
          country: null,
          resetToken: null,
          resetTokenExpiry: null,
          status: "SUSPENDED",
          anonymizedAt: marker.createdAt,
          anonymizedReason: marker.reason,
        },
      });
      await prisma.session.deleteMany({ where: { userId: marker.subjectId } });
      applied += 1;
      continue;
    }
    if (marker.subjectType === "ScopedRecord" && marker.action === "WITHDRAWN") {
      const updated = await prisma.scopedRecord.updateMany({
        where: { id: marker.subjectId, status: { not: "WITHDRAWN" } },
        data: { status: "WITHDRAWN", withdrawnAt: marker.createdAt, withdrawnById: marker.actorUserId },
      });
      if (updated.count === 0) skipped += 1;
      else applied += 1;
      continue;
    }
    skipped += 1;
  }

  return { replayed: markers.length, applied, skipped };
}
