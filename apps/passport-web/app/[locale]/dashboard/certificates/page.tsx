import { unstable_noStore as noStore } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { serializeCertificateCard } from "@/lib/server/certificate-module";
import { getPrismaClient } from "@/lib/server/prisma";
import { CertificatePortfolioPage } from "@/components/certificate-user-prototype";
import type { UserCertificateCard } from "@/components/certificate-user-prototype";
import type { Locale } from "@/lib/site-content";

export default async function UserCertificatesPage({
  params,
}: {
  params: { locale: Locale };
}) {
  noStore();
  const user = await requireAuthenticatedUser(params.locale, `/${params.locale}/dashboard/certificates`);
  const prisma = getPrismaClient();

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

  const rawCards = issues.map((issue) => serializeCertificateCard(params.locale, issue));
  const cards: UserCertificateCard[] = rawCards.map((card) => ({
    id: card.id,
    name: card.name,
    category: card.category,
    type: card.type,
    status: card.status,
    statusLabel: card.statusLabel,
    certificateNumber: card.certificateNumber,
    issuedAtLabel: card.issuedAtLabel,
    verificationCount: card.verificationCount,
    downloadCount: card.downloadCount,
    templateName: card.templateName,
    issuer: "Climate Passport",
    verificationUrl: card.verificationUrl ?? undefined,
  }));

  const categories = Array.from(new Set(cards.map((c) => c.category)));

  return (
    <CertificatePortfolioPage
      locale={params.locale}
      cards={cards}
      categories={categories}
    />
  );
}
