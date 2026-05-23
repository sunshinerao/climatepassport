import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { getCertificateName } from "@/lib/server/certificate-module";
import { getPrismaClient } from "@/lib/server/prisma";
import { AdminCertManager } from "@/components/admin-certificate-manager";
import type { Locale } from "@/lib/site-content";

export default async function AdminCertificateIssuePage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/certificates/issue`);
  const prisma = getPrismaClient();
  const isZh = params.locale === "zh";

  const [rawCategories, rawTemplates, rawIssues] = prisma
    ? await Promise.all([
        prisma.certificateCategory.findMany({ include: { _count: { select: { templates: true } } }, orderBy: { order: "asc" } }),
        prisma.certificateTemplate.findMany({ where: { isActive: true }, orderBy: { createdAt: "desc" }, take: 100 }),
        prisma.certificateIssue.findMany({
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { user: { select: { name: true, email: true } }, definition: { select: { name: true } } },
        }),
      ])
    : [[], [], []];

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{isZh ? "证书签发" : "Certificate Issuance"}</span>
          <h1>{isZh ? "手动与批量签发入口" : "Manual and batch-oriented issue flow"}</h1>
        </div>
        <p>{isZh ? "第一阶段支持按用户邮箱和模板手动签发；批量来源选择会在规则和名单接入后扩展。" : "Phase 1 supports manual issue by recipient email and template; batch sources will expand as rules and lists are connected."}</p>
      </div>
      <section className="section">
        <AdminCertManager
          locale={params.locale}
          categories={rawCategories.map((category) => ({
            id: category.id,
            key: category.key,
            name: category.name,
            nameEn: category.nameEn,
            description: category.description,
            isActive: category.isActive,
            templateCount: category._count.templates,
          }))}
          templates={rawTemplates.map((template) => ({
            id: template.id,
            name: template.name,
            nameEn: template.nameEn,
            templateType: template.templateType,
            isActive: template.isActive,
            version: template.version,
            categoryId: template.categoryId,
          }))}
          recentIssues={rawIssues.map((issue) => ({
            id: issue.id,
            status: issue.status,
            user: issue.user,
            definition: { name: getCertificateName(params.locale, issue.definition) },
            createdAt: issue.createdAt.toISOString(),
            issuedAt: issue.issuedAt?.toISOString() ?? null,
            verificationCode: issue.verificationCode,
          }))}
        />
      </section>
    </>
  );
}
