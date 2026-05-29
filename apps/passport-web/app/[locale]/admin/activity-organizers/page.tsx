import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";
import AdminActivityOrganizersClient from "@/components/admin-activity-organizers-client";

export default async function AdminActivityOrganizersPage({
  params,
}: {
  params: { locale: Locale };
}) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/activity-organizers`);

  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");

  const zh = params.locale === "zh";

  // Fetch all users who are EVENT_MANAGER, plus a broader search base (ADMIN/VERIFIER excluded from grant list)
  const [managerUsers, otherUsers, activityCounts] = await Promise.all([
    prisma.user.findMany({
      where: { role: "EVENT_MANAGER" },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: { in: ["ATTENDEE", "VERIFIER"] } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.activity.groupBy({
      by: ["organizerUserId"],
      where: { organizerUserId: { not: null } },
      _count: { id: true },
    }),
  ]);

  // Build lookup: userId → activity count
  const countMap: Record<string, number> = {};
  for (const row of activityCounts) {
    if (row.organizerUserId) countMap[row.organizerUserId] = row._count.id;
  }

  const allUsers = [
    ...managerUsers.map((u) => ({ ...u, organizedActivityCount: countMap[u.id] ?? 0 })),
    ...otherUsers.map((u) => ({ ...u, organizedActivityCount: countMap[u.id] ?? 0 })),
  ];

  return (
    <div>
      <nav >
        <a href={`/${params.locale}/admin`}>{zh ? "管理首页" : "Admin"}</a>
        <span>›</span>
        <span>{zh ? "活动主办方管理" : "Activity Organizers"}</span>
      </nav>

      <div className="section-header">
        <h1 className="label">{zh ? "活动主办方管理" : "Activity Organizers"}</h1>
        <p className="brand-subtitle">
          {zh
            ? "管理具有 EVENT_MANAGER 角色的用户，他们可以在管理后台创建和管理活动。"
            : "Manage users with the EVENT_MANAGER role. They can create and manage activities in the admin panel."}
        </p>
      </div>

      <div className="section">
        <div className="form-error form-success" style={{ marginBottom: "1rem" }}>
          {zh
            ? "授予 EVENT_MANAGER 角色后，该用户可访问活动管理后台，但无法访问证书、护照等高级管理功能（需要 ADMIN 角色）。"
            : "EVENT_MANAGER users can access the activities admin panel but not certificates, passports, or other advanced features (requires ADMIN role)."}
        </div>

        <AdminActivityOrganizersClient
          organizers={allUsers}
          locale={params.locale}
        />
      </div>

      <div className="section">
        <h2 className="section-header">{zh ? "快速导航" : "Quick Links"}</h2>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <a href={`/${params.locale}/admin/activities`} className="button button">
            {zh ? "← 活动管理" : "← Activities"}
          </a>
          <a href={`/${params.locale}/admin`} className="button button">
            {zh ? "管理首页" : "Admin Home"}
          </a>
        </div>
      </div>
    </div>
  );
}
