import { unstable_noStore as noStore } from "next/cache";
import { AdminPeopleManager } from "@/components/admin-people-manager";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { serializePerson } from "@/lib/server/people-master-data";
import type { Locale } from "@/lib/site-content";

export default async function LocalizedAdminPeoplePage({ params }: { params: { locale: Locale } }) {
  noStore();
  const user = await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/people`);
  const prisma = getPrismaClient();

  const [people, institutions] = prisma
    ? await Promise.all([
        prisma.person.findMany({
          orderBy: [{ displayName: "asc" }, { createdAt: "desc" }],
          include: {
            _count: { select: { affiliations: true, roleProfiles: true, speakers: true } },
          },
        }),
        prisma.institution.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true, slug: true },
        }),
      ])
    : [[], []];

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{params.locale === "zh" ? "人员主数据" : "People master data"}</span>
          <h1>{params.locale === "zh" ? "人员与演讲者身份" : "People and speaker identity"}</h1>
        </div>
        <p>
          {params.locale === "zh"
            ? "管理人员档案、机构隶属与角色标签。此模块仅管理员可见，不对外公开目录。"
            : "Manage person profiles, affiliations, and role labels. This module is admin-only and not a public directory."}
        </p>
      </div>

      <AdminPeopleManager
        initialPeople={people.map(serializePerson)}
        institutions={institutions}
        locale={params.locale}
        userRole={user.role}
      />
    </>
  );
}
