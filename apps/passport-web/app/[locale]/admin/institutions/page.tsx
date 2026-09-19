import { unstable_noStore as noStore } from "next/cache";
import { AdminInstitutionsManager } from "@/components/admin-institutions-manager";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { serializeInstitution } from "@/lib/server/people-master-data";
import type { Locale } from "@/lib/site-content";

export default async function LocalizedAdminInstitutionsPage({ params }: { params: { locale: Locale } }) {
  noStore();
  const user = await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/institutions`);
  const prisma = getPrismaClient();

  const institutions = prisma
    ? await prisma.institution.findMany({
        orderBy: [{ name: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          slug: true,
          name: true,
          nameEn: true,
          shortName: true,
          shortNameEn: true,
          legalName: true,
          aliases: true,
          orgType: true,
          governanceType: true,
          countryOrRegion: true,
          countryOrRegionEn: true,
          website: true,
          verificationStatus: true,
          isActive: true,
        },
      })
    : [];

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{params.locale === "zh" ? "机构主数据" : "Institution master data"}</span>
          <h1>{params.locale === "zh" ? "机构治理与别名" : "Institution governance and aliases"}</h1>
        </div>
        <p>
          {params.locale === "zh"
            ? "维护机构档案、治理类型、验证状态与公开联系信息。不改变现有活动/事件展示流程。"
            : "Maintain institution records, governance type, verification status, and public contact info. Existing event/activity presentation flows are unchanged."}
        </p>
      </div>

      <AdminInstitutionsManager
        initialInstitutions={institutions.map(serializeInstitution)}
        locale={params.locale}
        userRole={user.role}
      />
    </>
  );
}
