import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { CertificateCategoryForm } from "@/components/admin-certificate-config-forms";
import { CertificateAdminCategories } from "@/components/certificate-admin-prototype";
import type { Locale } from "@/lib/site-content";

export default async function AdminCertificateCategoriesPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/certificates/categories`);
  const prisma = getPrismaClient();
  const categories = prisma
    ? await prisma.certificateCategory.findMany({
        orderBy: { order: "asc" },
        include: { _count: { select: { templates: true, definitions: true } } },
      })
    : [];

  return (
    <CertificateAdminCategories
      locale={params.locale}
      categories={categories.map((category) => ({
        id: category.id,
        key: category.key,
        name: category.name,
        nameEn: category.nameEn,
        description: category.description,
        isActive: category.isActive,
        templateCount: category._count.templates,
        definitionCount: category._count.definitions,
      }))}
      form={<CertificateCategoryForm locale={params.locale} />}
    />
  );
}
