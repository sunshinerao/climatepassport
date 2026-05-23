import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { CertificateDownloadButton } from "@/components/certificate-actions";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { formatCertificateDate, getCertificateName, serializeCertificateCard } from "@/lib/server/certificate-module";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

export default async function UserCertificatesPage({
  params,
  searchParams,
}: {
  params: { locale: Locale };
  searchParams?: { q?: string; category?: string; status?: string };
}) {
  noStore();
  const user = await requireAuthenticatedUser(params.locale, `/${params.locale}/dashboard/certificates`);
  const prisma = getPrismaClient();
  const isZh = params.locale === "zh";
  const query = (searchParams?.q ?? "").trim().toLowerCase();
  const activeCategory = (searchParams?.category ?? "").trim();
  const activeStatus = (searchParams?.status ?? "").trim();

  const issues = prisma
    ? await prisma.certificateIssue.findMany({
        where: { userId: user.id },
        orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }],
        include: {
          definition: { include: { category: true, template: true } },
          verifications: { select: { id: true } },
        },
      })
    : [];

  const cards = issues.map((issue) => serializeCertificateCard(params.locale, issue));
  const filteredCards = cards.filter((card) => {
    const matchesCategory = !activeCategory || card.category === activeCategory;
    const matchesStatus = !activeStatus || card.status === activeStatus;
    const searchable = [
      card.name,
      card.category,
      card.templateName ?? "",
      card.type,
      card.statusLabel,
      card.certificateNumber,
    ].join(" ").toLowerCase();
    const matchesQuery = !query || searchable.includes(query);

    return matchesCategory && matchesStatus && matchesQuery;
  });
  const issuedCount = cards.filter((card) => card.status === "ISSUED").length;
  const verifiedCount = cards.filter((card) => card.verificationCount > 0 || card.status === "ISSUED").length;
  const recent = issues[0];
  const categories = Array.from(new Set(cards.map((card) => card.category)));
  const statuses = Array.from(new Set(cards.map((card) => card.status)));

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{isZh ? "我的证书" : "My Certificates"}</span>
          <h1>{isZh ? "可信能力资产" : "Credential Passport Overview"}</h1>
        </div>
        <p>
          {isZh
            ? "查看你已经获得的证书、徽章与可信记录，并下载或分享公开验证链接。"
            : "Review your certificates, badges, and trusted records, then download or share public verification links."}
        </p>
      </div>

      <section className="section card-grid compact-grid">
        <article className="data-card">
          <span className="status-badge">{cards.length}</span>
          <h3>{isZh ? "证书总数" : "Total credentials"}</h3>
          <p>{isZh ? "全部证书、徽章和能力记录" : "Certificates, badges, and capability records"}</p>
        </article>
        <article className="data-card">
          <span className="status-badge">{verifiedCount}</span>
          <h3>{isZh ? "已验证记录" : "Verified records"}</h3>
          <p>{isZh ? "可通过 Climate Passport 验真的记录" : "Records with Climate Passport verification"}</p>
        </article>
        <article className="data-card">
          <span className="status-badge">{issuedCount}</span>
          <h3>{isZh ? "已签发" : "Issued"}</h3>
          <p>{isZh ? "可下载或分享的有效证书" : "Active certificates ready to download or share"}</p>
        </article>
      </section>

      <section className="section panel certificate-overview-panel">
        <div>
          <span className="label">{isZh ? "最近获得" : "Most recent"}</span>
          <h2>{recent ? getCertificateName(params.locale, recent.definition) : isZh ? "暂无证书" : "No certificates yet"}</h2>
          <p>
            {recent
              ? `${getCertificateName(params.locale, recent.definition.category)} · ${formatCertificateDate(params.locale, recent.issuedAt ?? recent.createdAt)}`
              : isZh
                ? "完成课程、活动或项目后，证书会自动出现在这里。"
                : "Complete courses, events, or programs and certificates will appear here."}
          </p>
        </div>
        <div className="certificate-filter-strip">
          <span>{isZh ? "分类" : "Categories"}</span>
          {categories.length > 0 ? categories.map((category) => <b key={category}>{category}</b>) : <b>{isZh ? "暂无" : "None"}</b>}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <span className="label">{isZh ? "证书列表" : "Credential list"}</span>
            <h2>{isZh ? "全部可信记录" : "All trusted records"}</h2>
          </div>
          <p>
            {isZh
              ? `当前显示 ${filteredCards.length} / ${cards.length} 条记录。`
              : `Showing ${filteredCards.length} of ${cards.length} records.`}
          </p>
        </div>

        <form className="certificate-filter-form" action={`/${params.locale}/dashboard/certificates`}>
          <label className="field">
            <span>{isZh ? "搜索" : "Search"}</span>
            <input
              type="search"
              name="q"
              defaultValue={searchParams?.q ?? ""}
              placeholder={isZh ? "证书名称、编号、类型" : "Name, number, type"}
            />
          </label>
          <label className="field">
            <span>{isZh ? "分类" : "Category"}</span>
            <select name="category" defaultValue={activeCategory}>
              <option value="">{isZh ? "全部分类" : "All categories"}</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{isZh ? "状态" : "Status"}</span>
            <select name="status" defaultValue={activeStatus}>
              <option value="">{isZh ? "全部状态" : "All statuses"}</option>
              {statuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
          <div className="button-row">
            <button className="button" type="submit">{isZh ? "筛选" : "Apply"}</button>
            <Link className="button-outline" href={`/${params.locale}/dashboard/certificates`}>
              {isZh ? "重置" : "Reset"}
            </Link>
          </div>
        </form>

        {cards.length === 0 ? (
          <div className="panel">
            <p>{isZh ? "暂无证书。完成活动、课程或 Learning Experience 后，系统会在这里展示你的记录。" : "No certificates yet. Your records will appear here after events, courses, or Learning Experiences are completed."}</p>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="panel">
            <p>{isZh ? "没有匹配当前筛选条件的证书。" : "No certificates match the current filters."}</p>
          </div>
        ) : (
          <div className="certificate-card-grid">
            {filteredCards.map((card) => (
              <article className="certificate-card" key={card.id}>
                <div className="certificate-card-top">
                  <span className="status-badge">{card.statusLabel}</span>
                  <span>{card.type}</span>
                </div>
                <h3>{card.name}</h3>
                <p>{card.category}</p>
                <dl className="certificate-meta-grid">
                  <div>
                    <dt>{isZh ? "签发日期" : "Issued"}</dt>
                    <dd>{card.issuedAtLabel}</dd>
                  </div>
                  <div>
                    <dt>{isZh ? "证书编号" : "Certificate no."}</dt>
                    <dd>{card.certificateNumber}</dd>
                  </div>
                  <div>
                    <dt>{isZh ? "验证次数" : "Verifications"}</dt>
                    <dd>{card.verificationCount}</dd>
                  </div>
                  <div>
                    <dt>{isZh ? "下载次数" : "Downloads"}</dt>
                    <dd>{card.downloadCount}</dd>
                  </div>
                </dl>
                <div className="button-row">
                  <Link className="button-outline" href={`/${params.locale}/dashboard/certificates/${card.id}`}>
                    {isZh ? "查看详情" : "View detail"}
                  </Link>
                  {card.status === "ISSUED" ? <CertificateDownloadButton certificateId={card.id} label={isZh ? "下载" : "Download"} /> : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
