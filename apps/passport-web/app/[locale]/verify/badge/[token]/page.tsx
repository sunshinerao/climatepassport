import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import type { Locale } from "@/lib/site-content";
import { getPrismaClient } from "@/lib/server/prisma";

export default async function BadgeVerifyPage({
  params,
}: {
  params: { locale: Locale; token: string };
}) {
  noStore();
  const isZh = params.locale === "zh";
  const prisma = getPrismaClient();

  const award = prisma
    ? await prisma.badgeAward.findFirst({
        where: { verificationToken: params.token },
        include: {
          user: { select: { name: true } },
          badgeDefinition: {
            select: {
              name: true,
              nameZh: true,
              description: true,
              descriptionZh: true,
              verificationGrade: true,
              isPublic: true,
              issuerName: true,
            },
          },
        },
      })
    : null;

  const valid = Boolean(award && award.badgeDefinition.isPublic && award.status === "ACTIVE");

  return (
    <section className="section">
      <div className="panel" style={{ maxWidth: "780px", margin: "0 auto" }}>
        <h1>{isZh ? "徽章验证" : "Badge Verification"}</h1>
        {valid && award ? (
          <div className="stack" style={{ gap: "10px", marginTop: "14px" }}>
            <p><strong>{isZh ? "状态" : "Status"}:</strong> {isZh ? "有效" : "Valid"}</p>
            <p><strong>{isZh ? "徽章名称" : "Badge"}:</strong> {isZh ? award.badgeDefinition.nameZh ?? award.badgeDefinition.name : award.badgeDefinition.name}</p>
            <p><strong>{isZh ? "持有者" : "Holder"}:</strong> {award.user.name}</p>
            <p><strong>{isZh ? "签发方" : "Issuer"}:</strong> {award.badgeDefinition.issuerName ?? "Climate Passport"}</p>
            <p><strong>{isZh ? "授予时间" : "Awarded At"}:</strong> {new Date(award.awardedAt).toLocaleString(isZh ? "zh-CN" : "en-US")}</p>
            <p><strong>{isZh ? "可信等级" : "Verification Grade"}:</strong> {award.badgeDefinition.verificationGrade}</p>
            <p><strong>{isZh ? "说明" : "Description"}:</strong> {isZh ? award.badgeDefinition.descriptionZh ?? award.badgeDefinition.description ?? "-" : award.badgeDefinition.description ?? award.badgeDefinition.descriptionZh ?? "-"}</p>
          </div>
        ) : (
          <p style={{ marginTop: "14px" }}>{isZh ? "未找到有效徽章记录，或该徽章不公开。" : "Badge record not found, invalid, or not publicly visible."}</p>
        )}
        <div style={{ marginTop: "18px" }}>
          <Link className="button" href={`/${params.locale}/dashboard/climate-passport`}>{isZh ? "返回 Climate Passport" : "Back to Climate Passport"}</Link>
        </div>
      </div>
    </section>
  );
}
