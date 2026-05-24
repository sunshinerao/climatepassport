import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { formatCertificateDate, getCertificateName, getVerificationUrl } from "@/lib/server/certificate-module";
import { getPrismaClient } from "@/lib/server/prisma";
import { PublicProfilePage } from "@/components/certificate-profile-prototype";
import type { ProfileData, ProfileCredential } from "@/components/certificate-profile-prototype";

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

  const credentials: ProfileCredential[] = user.certificateIssues.map((issue, index) => ({
    id: issue.id,
    name: getCertificateName("en", issue.definition),
    category: getCertificateName("en", issue.definition.category),
    type: issue.definition.template.templateType,
    issuedAt: formatCertificateDate("en", issue.issuedAt ?? issue.createdAt),
    verificationUrl: getVerificationUrl(issue.verificationCode) ?? undefined,
    isFeatured: index < 3,
  }));

  const categories = Array.from(new Set(credentials.map((c) => c.category)));

  const data: ProfileData = {
    name: user.name,
    title: user.title ?? undefined,
    passportId: user.climatePassportId ?? undefined,
    isVerified: true,
    credentials,
    competencies: categories.map((cat, i) => ({
      name: cat,
      level: i === 0 ? "advanced" : i < 3 ? "intermediate" : "beginner",
    })),
    timeline: credentials.slice(0, 6).map((cred) => ({
      date: cred.issuedAt,
      title: cred.name,
      type: cred.type,
      verificationUrl: cred.verificationUrl,
    })),
    programs: [
      { name: "Shanghai Climate Week 2026", status: "Active", description: "Multi-disciplinary climate action event participation" },
      { name: "Climate Passport Credential Program", status: "Active", description: "Digital verified credential system" },
    ],
  };

  return <PublicProfilePage locale="en" data={data} />;
}
