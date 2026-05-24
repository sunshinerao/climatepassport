import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { CertificateAdminRules } from "@/components/certificate-admin-prototype";
import type { Locale } from "@/lib/site-content";

export default async function AdminCertificateRulesPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/certificates/rules`);
  const prisma = getPrismaClient();
  const templates = prisma
    ? await prisma.certificateTemplate.findMany({
        where: { isActive: true },
        orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
        take: 30,
      })
    : [];

  return (
    <CertificateAdminRules
      locale={params.locale}
      templates={templates.map((template) => ({
        id: template.id,
        name: template.name,
        nameEn: template.nameEn,
        templateType: template.templateType,
        isActive: template.isActive,
        version: template.version,
      }))}
    />
  );
}
