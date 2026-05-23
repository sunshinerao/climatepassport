import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { getCertificateName } from "@/lib/server/certificate-module";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

export default async function AdminCertificateCategoriesPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/certificates/categories`);
  const prisma = getPrismaClient();
  const isZh = params.locale === "zh";
  const categories = prisma
    ? await prisma.certificateCategory.findMany({
        orderBy: { order: "asc" },
        include: { _count: { select: { templates: true, definitions: true } } },
      })
    : [];

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{isZh ? "分类管理" : "Category Management"}</span>
          <h1>{isZh ? "证书类型与默认能力" : "Credential categories"}</h1>
        </div>
        <p>{isZh ? "管理课程证书、活动出席证书、角色证书、成就徽章和里程碑证书等类型。" : "Manage course, attendance, role, achievement, and milestone credential categories."}</p>
      </div>

      <section className="section certificate-card-grid">
        {categories.map((category) => (
          <article className="certificate-card" key={category.id}>
            <div className="certificate-card-top">
              <span className="status-badge">{category.isActive ? (isZh ? "启用" : "Active") : (isZh ? "停用" : "Inactive")}</span>
              <span>{category.key}</span>
            </div>
            <h3>{getCertificateName(params.locale, category)}</h3>
            <p>{params.locale === "zh" ? category.description : category.descriptionEn ?? category.description}</p>
            <dl className="certificate-meta-grid">
              <div><dt>{isZh ? "模板" : "Templates"}</dt><dd>{category._count.templates}</dd></div>
              <div><dt>{isZh ? "定义" : "Definitions"}</dt><dd>{category._count.definitions}</dd></div>
              <div><dt>{isZh ? "自动签发" : "Auto issue"}</dt><dd>{category.isActive ? (isZh ? "允许配置" : "Configurable") : "—"}</dd></div>
              <div><dt>{isZh ? "公开验证" : "Public verify"}</dt><dd>{isZh ? "支持" : "Supported"}</dd></div>
            </dl>
          </article>
        ))}
      </section>
    </>
  );
}
