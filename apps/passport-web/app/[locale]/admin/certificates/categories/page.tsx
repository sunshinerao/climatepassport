import { unstable_noStore as noStore } from "next/cache";
import { randomUUID } from "node:crypto";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { CertificateAdminCategoriesClient } from "@/components/certificate-admin-categories-client";
import type { Locale } from "@/lib/site-content";

type LegacyCertificateCategoryRow = {
  id: string;
  key: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  order: number;
  createdAt: Date;
  autoIssueEnabled: boolean;
  userRequestEnabled: boolean;
  pdfEnabled: boolean;
  publicVerifyEnabled: boolean;
  isActive: boolean;
};

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
    const maxOrderRows = await prisma.$queryRaw<Array<{ maxOrder: number | null }>>`
      SELECT MAX("order")::int AS "maxOrder"
      FROM "certificate_categories"
    `;
    const baseOrder = (maxOrderRows[0]?.maxOrder ?? -1) + 1;
    const now = new Date();

    await prisma.$transaction(
      builtInCategoryPresets.map((preset, index) => prisma.$executeRaw`
        INSERT INTO "certificate_categories" (
          "id", "key", "name", "nameEn", "isActive", "order", "updatedAt"
        )
        SELECT ${randomUUID()}, ${preset.key}, ${preset.name}, ${preset.nameEn}, true, ${baseOrder + index}, ${now}
        WHERE NOT EXISTS (
          SELECT 1 FROM "certificate_categories" WHERE "key" = ${preset.key}
        )
      `),
    );
  }

  const categories = prisma
    ? await (async () => {
        const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'certificate_categories'
        `;
        const columnSet = new Set(columns.map((column) => column.column_name));
        const autoIssueSelect = columnSet.has("autoIssueEnabled")
          ? `"autoIssueEnabled"`
          : `true AS "autoIssueEnabled"`;
        const userRequestSelect = columnSet.has("userRequestEnabled")
          ? `"userRequestEnabled"`
          : `false AS "userRequestEnabled"`;
        const pdfSelect = columnSet.has("pdfEnabled")
          ? `"pdfEnabled"`
          : `true AS "pdfEnabled"`;
        const publicVerifySelect = columnSet.has("publicVerifyEnabled")
          ? `"publicVerifyEnabled"`
          : `true AS "publicVerifyEnabled"`;

        return prisma.$queryRawUnsafe<LegacyCertificateCategoryRow[]>(`
          SELECT
            id,
            key,
            name,
            "nameEn",
            description,
            "descriptionEn",
            "order",
            "createdAt",
            ${autoIssueSelect},
            ${userRequestSelect},
            ${pdfSelect},
            ${publicVerifySelect},
            "isActive"
          FROM "certificate_categories"
          ORDER BY "order" ASC
        `);
      })()
    : [];
  const templateCounts = prisma
    ? await prisma.certificateTemplate.groupBy({
        by: ["categoryId"],
        _count: { _all: true },
      })
    : [];
  const definitionCounts = prisma
    ? await prisma.certificateDefinition.groupBy({
        by: ["categoryId"],
        _count: { _all: true },
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
  const templateCountMap = new Map(templateCounts.map((row) => [row.categoryId, row._count._all]));
  const definitionCountMap = new Map(definitionCounts.map((row) => [row.categoryId, row._count._all]));

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
        templateCount: templateCountMap.get(category.id) ?? 0,
        definitionCount: definitionCountMap.get(category.id) ?? 0,
        issuedCount: issuedByCategory[category.id] ?? 0,
      }))}
    />
  );
}
