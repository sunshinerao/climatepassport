import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { AdminLearningApplicationsManager } from "@/components/admin-learning-applications-manager";
import { AdminLearningProgramsManager } from "@/components/admin-learning-programs-manager";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { serializeLearningProgram } from "@/lib/server/admin-learning-experiences";
import type { Locale } from "@/lib/site-content";

export default async function LocalizedAdminLearningExperiencesPage({
  params,
}: {
  params: { locale: Locale };
}) {
  noStore();
  const user = await requireRoleAccess(
    params.locale,
    ["ADMIN", "EVENT_MANAGER"],
    `/${params.locale}/admin/learning-experiences`,
  );
  const prisma = getPrismaClient();

  const [programs, categories, managers, applications] = prisma
    ? await Promise.all([
        prisma.learningExperienceProgram.findMany({
          where: user.role === "ADMIN" ? undefined : { managerUserId: user.id },
          orderBy: [{ updatedAt: "desc" }],
          include: {
            category: {
              select: {
                name: true,
                nameEn: true,
              },
            },
            manager: {
              select: {
                name: true,
              },
            },
            _count: {
              select: {
                applications: true,
                participations: true,
              },
            },
          },
        }),
        prisma.learningExperienceCategory.findMany({
          where: { isActive: true },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            name: true,
            nameEn: true,
          },
        }),
        prisma.user.findMany({
          where: {
            role: { in: ["ADMIN", "EVENT_MANAGER"] },
            status: "ACTIVE",
          },
          orderBy: [{ role: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            role: true,
          },
        }),
        prisma.learningExperienceApplication.findMany({
          where:
            user.role === "ADMIN"
              ? undefined
              : {
                  program: {
                    managerUserId: user.id,
                  },
                },
          orderBy: [{ updatedAt: "desc" }],
          take: 120,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            program: {
              select: {
                id: true,
                slug: true,
                title: true,
                titleEn: true,
                stages: {
                  orderBy: { order: "asc" },
                  select: {
                    id: true,
                    key: true,
                    name: true,
                    nameEn: true,
                    order: true,
                  },
                },
              },
            },
            currentStage: {
              select: {
                id: true,
                key: true,
                name: true,
                nameEn: true,
                order: true,
              },
            },
            participation: {
              select: {
                id: true,
                status: true,
                completionPercent: true,
                pointsAwarded: true,
              },
            },
          },
        }),
      ])
    : [[], [], [], []];

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">
            {params.locale === "zh" ? "Learning Experiences 后台" : "Learning Experiences admin"}
          </span>
          <h1>{params.locale === "zh" ? "项目与申请管理" : "Program and application management"}</h1>
        </div>
        <p>
          {params.locale === "zh"
            ? "Learning Experiences 已从文档层进入可运行后台。项目、申请和 Event 关联将作为独立域继续迭代。"
            : "Learning Experiences now has a runnable admin entry. Programs, applications, and Event linkage will continue as an independent domain."}
        </p>
      </div>

      <section className="section panel">
        <span className="label">{params.locale === "zh" ? "后台快捷入口" : "Admin quick links"}</span>
        <div className="certificate-operation-links">
          <Link href={`/${params.locale}/admin`}>{params.locale === "zh" ? "控制台总览" : "Dashboard"}</Link>
          <Link href={`/${params.locale}/admin/events`}>{params.locale === "zh" ? "活动管理" : "Event management"}</Link>
          <Link href={`/${params.locale}/admin/learning-experiences`}>{params.locale === "zh" ? "学习项目" : "Learning experiences"}</Link>
          {user.role === "ADMIN" ? (
            <Link href={`/${params.locale}/admin/summer-school/applications`}>
              {params.locale === "zh" ? "夏校申请" : "Summer school apps"}
            </Link>
          ) : null}
          {user.role === "ADMIN" ? (
            <Link href={`/${params.locale}/admin/certificates`}>
              {params.locale === "zh" ? "证书中心" : "Certificate hub"}
            </Link>
          ) : null}
        </div>
      </section>

      <AdminLearningProgramsManager
        categories={categories}
        initialPrograms={programs.map(serializeLearningProgram)}
        locale={params.locale}
        managers={managers}
        userRole={user.role}
      />

      <AdminLearningApplicationsManager
        initialApplications={applications.map((item) => ({
          id: item.id,
          status: item.status,
          reviewNotes: item.reviewNotes,
          submittedAt: item.submittedAt?.toISOString() ?? null,
          reviewedAt: item.reviewedAt?.toISOString() ?? null,
          decidedAt: item.decidedAt?.toISOString() ?? null,
          updatedAt: item.updatedAt.toISOString(),
          user: item.user,
          program: item.program,
          currentStage: item.currentStage,
          participation: item.participation,
        }))}
        locale={params.locale}
      />
    </>
  );
}
