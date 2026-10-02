/**
 * CP-TODO-257：隐私安全聚合报告（CP-FR-067）。
 *
 * 原则：
 * - 只出聚合量，永不返回个体行；人数/条数分列，主体去重口径明确。
 * - 小样本抑制：0 < 单元格 < 阈值时输出 null 并标记 suppressedCells；
 *   阈值由环境 CP_PRIVACY_REPORT_MIN_CELL 配置（默认 5），审批后调整。
 * - 撤销可复算：统计读取的都是当前状态（撤回/删除立即反映）。
 */

import type { PrismaClient } from "@prisma/client";

type PrismaLike = Pick<PrismaClient, "activityApplication" | "activityParticipation" | "activityCheckinRecord">;

export function privacyReportThreshold(): number {
  const raw = Number.parseInt(process.env.CP_PRIVACY_REPORT_MIN_CELL ?? "5", 10);
  return Number.isInteger(raw) && raw >= 1 ? raw : 5;
}

function suppressCell(count: number, threshold: number): number | null {
  return count > 0 && count < threshold ? null : count;
}

export async function activityPrivacyReport(
  prisma: PrismaLike,
  input: { activityId: string; threshold?: number }
): Promise<{
  activityId: string;
  threshold: number;
  applicationsByStatus: Record<string, number | null>;
  participationsByStatus: Record<string, number | null>;
  checkinCount: number | null;
  distinctPersons: number | null;
  suppressedCells: string[];
}> {
  const threshold = input.threshold ?? privacyReportThreshold();
  const suppressedCells: string[] = [];

  const applications = await prisma.activityApplication.findMany({
    where: { activityId: input.activityId },
    select: { status: true, userId: true },
  });
  const participations = await prisma.activityParticipation.findMany({
    where: { activityId: input.activityId },
    select: { status: true, userId: true },
  });
  const checkins = await prisma.activityCheckinRecord.findMany({
    where: { activityId: input.activityId },
    select: { id: true },
  });

  const countBy = (rows: Array<{ status: string }>, prefix: string): Record<string, number | null> => {
    const counts: Record<string, number> = {};
    for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
    const result: Record<string, number | null> = {};
    for (const [status, count] of Object.entries(counts)) {
      const suppressed = suppressCell(count, threshold);
      if (suppressed === null) suppressedCells.push(`${prefix}.${status}`);
      result[status] = suppressed;
    }
    return result;
  };

  const distinct = new Set([...applications.map((row) => row.userId), ...participations.map((row) => row.userId)]).size;
  const distinctPersons = suppressCell(distinct, threshold);
  if (distinctPersons === null) suppressedCells.push("distinctPersons");
  const checkinCount = suppressCell(checkins.length, threshold);
  if (checkinCount === null) suppressedCells.push("checkinCount");

  return {
    activityId: input.activityId,
    threshold,
    applicationsByStatus: countBy(applications, "applications"),
    participationsByStatus: countBy(participations, "participations"),
    checkinCount,
    distinctPersons,
    suppressedCells,
  };
}
