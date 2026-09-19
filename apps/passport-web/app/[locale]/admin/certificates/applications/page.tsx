import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { CertificateAdminApplications } from "@/components/certificate-admin-prototype";
import type { Locale } from "@/lib/site-content";

export default async function AdminCertificateApplicationsPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/certificates/applications`);
  return (
    <CertificateAdminApplications
      locale={params.locale}
    />
  );
}
