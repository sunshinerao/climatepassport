import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { formatCertificateDate, getCertificateName, getVerificationUrl } from "@/lib/server/certificate-module";
import { getPrismaClient } from "@/lib/server/prisma";

export default async function PublicProfileCredentialsPage({ params }: { params: { userId: string } }) {
  noStore();
  const prisma = getPrismaClient();
  const user = prisma
    ? await prisma.user.findFirst({
        where: {
          OR: [
            { id: params.userId },
            { climatePassportId: params.userId },
          ],
        },
        select: {
          id: true,
          name: true,
          title: true,
          climatePassportId: true,
          certificateIssues: {
            where: { status: "ISSUED", publicVisible: true },
            orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }],
            include: { definition: { include: { category: true, template: true } }, verifications: { select: { id: true } } },
          },
        },
      })
    : null;

  if (!user) {
    notFound();
  }

  const tags = Array.from(new Set(user.certificateIssues.map((issue) => issue.definition.category.nameEn ?? issue.definition.category.name)));

  return (
    <section className="certificate-verify-page">
      <div className="section-header">
        <div>
          <span className="label">Public Credential Profile</span>
          <h1>{user.name}</h1>
        </div>
        <p>{user.title ?? "Verified Climate Passport credential holder"}</p>
      </div>

      <section className="section card-grid compact-grid">
        <article className="data-card"><span className="status-badge">{user.certificateIssues.length}</span><h3>Public credentials</h3><p>Issued credentials available for third-party verification.</p></article>
        <article className="data-card"><span className="status-badge">{tags.length}</span><h3>Capability tags</h3><p>{tags.slice(0, 4).join(", ") || "No public tags yet"}</p></article>
        <article className="data-card"><span className="status-badge">Verified</span><h3>Climate Passport</h3><p>{user.climatePassportId ?? "Passport ID not disclosed"}</p></article>
      </section>

      <section className="section certificate-card-grid">
        {user.certificateIssues.map((issue) => {
          const verificationUrl = getVerificationUrl(issue.verificationCode);
          return (
            <article className="certificate-card" key={issue.id}>
              <div className="certificate-card-top">
                <span className="status-badge">Issued</span>
                <span>{issue.definition.template.templateType}</span>
              </div>
              <h3>{getCertificateName("en", issue.definition)}</h3>
              <p>{getCertificateName("en", issue.definition.category)}</p>
              <dl className="certificate-meta-grid">
                <div><dt>Issued</dt><dd>{formatCertificateDate("en", issue.issuedAt ?? issue.createdAt)}</dd></div>
                <div><dt>Verifications</dt><dd>{issue.verifications.length}</dd></div>
              </dl>
              {verificationUrl ? (
                <div className="button-row">
                  <Link className="button-outline" href={verificationUrl}>Verify credential</Link>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </section>
  );
}
