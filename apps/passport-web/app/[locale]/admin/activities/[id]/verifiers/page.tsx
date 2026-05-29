import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { AdminActivityVerifiersClient } from "@/components/admin-activity-verifiers-client";
import type { Locale } from "@/lib/site-content";

export default async function AdminActivityVerifiersPage({ params }: { params: { locale: Locale; id: string } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN", "EVENT_MANAGER"], `/${params.locale}/admin/activities/${params.id}/verifiers`);

  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");

  const [activity, verifiers, availableVerifiers] = await Promise.all([
    prisma.activity.findUnique({
      where: { id: params.id },
      select: { id: true, title: true, type: true },
    }),
    prisma.activityVerifier.findMany({
      where: { activityId: params.id },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: {
        role: { in: ["VERIFIER", "ADMIN", "EVENT_MANAGER"] },
        status: "ACTIVE",
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
  ]);

  if (!activity) notFound();

  return (
    <div>
      <nav >
        <a href={`/${params.locale}/admin/activities`}>{params.locale === "zh" ? "活动管理" : "Activities"}</a>
        <span>›</span>
        <a href={`/${params.locale}/admin/activities/${params.id}`}>{activity.title}</a>
        <span>›</span>
        <span>{params.locale === "zh" ? "验证员分配" : "Verifiers"}</span>
      </nav>
      <div className="section-header">
        <h1 className="label">{params.locale === "zh" ? "验证员分配" : "Verifiers"}</h1>
        <p className="brand-subtitle">{activity.title}</p>
      </div>
      <AdminActivityVerifiersClient
        locale={params.locale}
        activityId={params.id}
        initialVerifiers={verifiers.map((v) => ({
          ...v,
          createdAt: v.createdAt.toISOString(),
        }))}
        availableVerifiers={availableVerifiers}
      />
    </div>
  );
}
