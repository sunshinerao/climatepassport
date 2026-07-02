import { unstable_noStore as noStore } from "next/cache";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell";
import { requireRoleAccess } from "@/lib/server/auth";
import type { Locale } from "@/lib/site-content";
import { privatePageMetadata } from "@/lib/seo";

export const metadata = privatePageMetadata;

export default async function LocalizedAdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: Locale };
}) {
  noStore();
  const user = await requireRoleAccess(params.locale, ["ADMIN", "EVENT_MANAGER"], `/${params.locale}/admin`);

  return (
    <AdminShell locale={params.locale} userRole={user.role}>
      {children}
    </AdminShell>
  );
}
