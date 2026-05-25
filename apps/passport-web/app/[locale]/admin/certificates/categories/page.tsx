import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { CertificateAdminCategoriesClient } from "@/components/certificate-admin-categories-client";
import type { Locale } from "@/lib/site-content";

const builtInCategoryPresets = [
  { key: "course-certificate", name: "课程证书", nameEn: "Course Certificate" },
  { key: "event-attendance", name: "活动出席证明", nameEn: "Event Attendance" },
  { key: "speaker-certificate", name: "演讲嘉宾证书", nameEn: "Speaker Certificate" },
  { key: "moderator-certificate", name: "主持人证书", nameEn: "Moderator Certificate" },
  { key: "volunteer-certificate", name: "志愿服务证书", nameEn: "Volunteer Certificate" },
  { key: "achievement-badge", name: "成就徽章", nameEn: "Achievement Badge" },
  { key: "milestone-certificate", name: "里程碑证书", nameEn: "Milestone Certificate" },
] as const;

export default async function AdminCertificateCategoriesPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/certificates/categories`);
  const prisma = getPrismaClient();

  if (prisma) {
    const maxOrder = await prisma.certificateCategory.aggregate({ _max: { order: true } });
    const baseOrder = (maxOrder._max.order ?? -1) + 1;

    await prisma.$transaction(
      builtInCategoryPresets.map((preset, index) => prisma.certificateCategory.upsert({
        where: { key: preset.key },
        update: {},
        create: {
          key: preset.key,
          name: preset.name,
          nameEn: preset.nameEn,
          isActive: true,
          order: baseOrder + index,
        },
      })),
    );
  }

  const categories = prisma
    ? await prisma.certificateCategory.findMany({
        orderBy: { order: "asc" },
        include: { _count: { select: { templates: true, definitions: true } } },
      })
    : [];
  const issuedByDefinition = prisma
    ? await prisma.certificateDefinition.findMany({
        select: {
          categoryId: true,
          _count: { select: { issues: true } },
        },
      })
    : [];
  const issuedByCategory = issuedByDefinition.reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.categoryId] = (accumulator[row.categoryId] ?? 0) + row._count.issues;
    return accumulator;
  }, {});

  return (
    <CertificateAdminCategoriesClient
      locale={params.locale}
      categories={categories.map((category) => ({
        id: category.id,
        key: category.key,
        name: category.name,
        nameEn: category.nameEn,
        description: category.description,
        descriptionEn: category.descriptionEn,
        order: category.order,
        autoIssueEnabled: category.autoIssueEnabled,
        userRequestEnabled: category.userRequestEnabled,
        pdfEnabled: category.pdfEnabled,
        publicVerifyEnabled: category.publicVerifyEnabled,
        createdAt: category.createdAt.toISOString(),
        isActive: category.isActive,
        templateCount: category._count.templates,
        definitionCount: category._count.definitions,
        issuedCount: issuedByCategory[category.id] ?? 0,
      }))}
    />
  );
}
