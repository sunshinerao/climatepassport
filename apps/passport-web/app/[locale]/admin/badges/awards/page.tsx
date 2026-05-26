import { unstable_noStore as noStore } from "next/cache";
import { AdminBadgeAwardsClient } from "@/components/admin-badge-awards-client";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

export default async function AdminBadgeAwardsPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/badges/awards`);
  const prisma = getPrismaClient();

  const awards = prisma
    ? await prisma.badgeAward.findMany({
        orderBy: [{ awardedAt: "desc" }],
        take: 300,
        include: {
          user: { select: { name: true, email: true } },
          badgeDefinition: { select: { name: true, code: true, category: true, level: true } },
        },
      })
    : [];

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{params.locale === "zh" ? "徽章授予" : "Badge awards"}</span>
          <h1>{params.locale === "zh" ? "授予记录与撤销管理" : "Award records and revoke management"}</h1>
        </div>
        <p>
          {params.locale === "zh"
            ? "查看全部徽章授予记录，支持撤销处理与审计。"
            : "Inspect awarded badge records and manage revoke operations with auditability."}
        </p>
      </div>
      <AdminBadgeAwardsClient initialRows={awards} locale={params.locale} />
    </>
  );
}
