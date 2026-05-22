import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { AdminCertManager } from "@/components/admin-certificate-manager";
import type { Locale } from "@/lib/site-content";

export default async function AdminCertificatesPage({ params }: { params: { locale: Locale } }) {
  noStore();
  const user = await requireRoleAccess(
    params.locale,
    ["ADMIN", "EVENT_MANAGER"],
    `/${params.locale}/admin/certificates`,
  );
  const prisma = getPrismaClient();
  const isZh = params.locale === "zh";

  const [rawCategories, rawTemplates, rawIssues] = prisma
    ? await Promise.all([
        prisma.certificateCategory.findMany({
          orderBy: { order: "asc" },
          include: {
            _count: { select: { templates: true } },
          },
        }),
        prisma.certificateTemplate.findMany({
          orderBy: { createdAt: "desc" },
          take: 60,
        }),
        prisma.certificateIssue.findMany({
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            user: { select: { name: true, email: true } },
            definition: { select: { name: true } },
          },
        }),
      ])
    : [[], [], []];

  const categories = rawCategories.map((c) => ({
    id: c.id,
    key: c.key,
    name: c.name,
    nameEn: c.nameEn,
    description: c.description,
    isActive: c.isActive,
    templateCount: c._count.templates,
  }));

  const templates = rawTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    nameEn: t.nameEn,
    templateType: t.templateType,
    isActive: t.isActive,
    version: t.version,
    categoryId: t.categoryId,
  }));

  const recentIssues = rawIssues.map((i) => ({
    id: i.id,
    status: i.status,
    user: i.user,
    definition: i.definition,
    createdAt: i.createdAt.toISOString(),
    issuedAt: i.issuedAt?.toISOString() ?? null,
    verificationCode: i.verificationCode,
  }));

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{isZh ? "证书管理" : "Certificate Management"}</span>
          <h1>{isZh ? "证书分类与颁发管理" : "Certificate categories, templates & issuance"}</h1>
        </div>
        <p>
          {isZh
            ? "管理证书分类与模版体系，并向指定用户手动颁发证书。"
            : "Manage the certificate category and template system, and manually issue certificates to specific users."}
        </p>
      </div>

      <section className="section card-grid compact-grid">
        <article className="data-card">
          <span className="status-badge">{user.role}</span>
          <h3>{isZh ? "当前权限" : "Current permission"}</h3>
          <p>{user.title ?? user.role}</p>
        </article>
        <article className="data-card">
          <span className="status-badge">{categories.length}</span>
          <h3>{isZh ? "证书分类" : "Certificate categories"}</h3>
          <p>{isZh ? "已创建的证书分类数量" : "Number of certificate categories created"}</p>
        </article>
        <article className="data-card">
          <span className="status-badge">{templates.length}</span>
          <h3>{isZh ? "证书模版" : "Certificate templates"}</h3>
          <p>{isZh ? "最近 60 个模版" : "Latest 60 templates"}</p>
        </article>
        <article className="data-card">
          <span className="status-badge">{recentIssues.length}</span>
          <h3>{isZh ? "近期颁发" : "Recent issues"}</h3>
          <p>{isZh ? "最近 20 条颁发记录" : "Latest 20 certificate issue records"}</p>
        </article>
      </section>

      <section className="section">
        <AdminCertManager
          locale={params.locale}
          categories={categories}
          templates={templates}
          recentIssues={recentIssues}
        />
      </section>
    </>
  );
}
