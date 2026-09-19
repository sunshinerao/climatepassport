import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import { CertificateAdminRules } from "@/components/certificate-admin-prototype";
import type { Locale } from "@/lib/site-content";

export default async function AdminCertificateRulesPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/certificates/rules`);
  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable.");
  const [rules, activities, definitions] = await Promise.all([
    prisma.activityCertificateRule.findMany({
      include: {
        activity: { select: { id: true, title: true, titleEn: true } },
        certificateDefinition: { include: { template: true, category: true } },
        _count: { select: { issuances: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 200,
    }),
    prisma.activity.findMany({ select: { id: true, title: true, titleEn: true }, orderBy: { updatedAt: "desc" }, take: 100 }),
    prisma.certificateDefinition.findMany({ where: { isActive: true, template: { isActive: true }, category: { isActive: true, autoIssueEnabled: true } }, select: { id: true, name: true, nameEn: true }, orderBy: { updatedAt: "desc" }, take: 100 }),
  ]);

  return (
    <CertificateAdminRules
      locale={params.locale}
      activities={activities}
      definitions={definitions}
      initialRules={rules.map((rule) => {
        const eligible = rule.trigger === "ACTIVITY_CHECKIN" && !rule.requiresAdminConfirmation && !rule.conditionJson && rule.certificateDefinition.isActive && rule.certificateDefinition.approvalMode === "auto" && rule.certificateDefinition.template.isActive && rule.certificateDefinition.category.isActive && rule.certificateDefinition.category.autoIssueEnabled;
        return { id: rule.id, name: rule.name, activityId: rule.activityId, certificateDefinitionId: rule.certificateDefinitionId, trigger: rule.trigger, isActive: rule.isActive, notifyUser: rule.notifyUser, eligible, effective: eligible && rule.isActive && rule.autoIssue, activity: rule.activity, certificateDefinition: { id: rule.certificateDefinition.id, name: rule.certificateDefinition.name, nameEn: rule.certificateDefinition.nameEn }, _count: rule._count };
      })}
    />
  );
}
