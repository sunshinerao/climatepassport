import { unstable_noStore as noStore } from "next/cache";
import { AdminBadgeDefinitionsClient } from "@/components/admin-badge-definitions-client";
import { ensureMvpBadgeDefinitions } from "@/lib/server/achievement-badge";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

export default async function AdminBadgeDefinitionsPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/badges/definitions`);
  const prisma = getPrismaClient();

  if (prisma) {
    await ensureMvpBadgeDefinitions();
  }

  const definitions = prisma
    ? await prisma.badgeDefinition.findMany({
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        take: 200,
      })
    : [];

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{params.locale === "zh" ? "徽章定义" : "Badge definitions"}</span>
          <h1>{params.locale === "zh" ? "徽章规则与可信等级" : "Badge rules and verification grades"}</h1>
        </div>
        <p>
          {params.locale === "zh"
            ? "管理徽章定义、类别、等级、可信等级与启停状态。"
            : "Manage badge definitions, categories, levels, verification grades, and activation state."}
        </p>
      </div>
      <AdminBadgeDefinitionsClient initialRows={definitions} locale={params.locale} />
    </>
  );
}
