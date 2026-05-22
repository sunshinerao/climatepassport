import { unstable_noStore as noStore } from "next/cache";
import { LearningExperiencesDashboard } from "@/components/learning-experiences-dashboard";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

export default async function LocalizedLearningExperiencesDashboardPage({
  params,
}: {
  params: { locale: Locale };
}) {
  noStore();
  const user = await requireAuthenticatedUser(params.locale, `/${params.locale}/dashboard/learning-experiences`);
  const prisma = getPrismaClient();

  const [programs, applications] = prisma
    ? await Promise.all([
        prisma.learningExperienceProgram.findMany({
          where: {
            isPublished: true,
            status: { in: ["PUBLISHED", "CLOSED"] },
          },
          orderBy: [{ applicationOpenAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            slug: true,
            title: true,
            titleEn: true,
            summary: true,
            summaryEn: true,
            location: true,
            locationEn: true,
            applicationOpenAt: true,
            applicationCloseAt: true,
            capacity: true,
            status: true,
            category: {
              select: {
                name: true,
                nameEn: true,
              },
            },
          },
        }),
        prisma.learningExperienceApplication.findMany({
          where: { userId: user.id },
          orderBy: [{ updatedAt: "desc" }],
          select: {
            id: true,
            programId: true,
            status: true,
            submittedAt: true,
            updatedAt: true,
            answersJson: true,
            program: {
              select: {
                slug: true,
                title: true,
                titleEn: true,
              },
            },
          },
        }),
      ])
    : [[], []];

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">
            {params.locale === "zh" ? "Learning Experiences" : "Learning Experiences"}
          </span>
          <h1>{params.locale === "zh" ? "项目申请与进度闭环" : "Program application lifecycle"}</h1>
        </div>
        <p>
          {params.locale === "zh"
            ? "这里是 Climate Passport 内部的 LE 闭环入口：项目发现、申请草稿、提交审核和状态追踪都在同一会话中完成。"
            : "This is the LE closed-loop entry inside Climate Passport: discovery, draft authoring, submission, and status tracking in one session."}
        </p>
      </div>

      <LearningExperiencesDashboard
        initialApplications={applications.map((item) => ({
          ...item,
          submittedAt: item.submittedAt?.toISOString() ?? null,
          updatedAt: item.updatedAt.toISOString(),
        }))}
        initialPrograms={programs.map((item) => ({
          id: item.id,
          slug: item.slug,
          title: item.title,
          titleEn: item.titleEn,
          summary: item.summary,
          summaryEn: item.summaryEn,
          location: item.location,
          locationEn: item.locationEn,
          applicationOpenAt: item.applicationOpenAt?.toISOString() ?? null,
          applicationCloseAt: item.applicationCloseAt?.toISOString() ?? null,
          capacity: item.capacity,
          status: item.status,
          categoryName: item.category?.name ?? null,
          categoryNameEn: item.category?.nameEn ?? null,
        }))}
        locale={params.locale}
      />
    </>
  );
}
