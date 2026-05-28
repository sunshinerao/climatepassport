import { unstable_noStore as noStore } from "next/cache";
import { AdminSystemSettingsClient } from "@/components/admin-system-settings-client";
import { AdminSystemDiagnosticsClient } from "@/components/admin-system-diagnostics-client";
import { requireRoleAccess } from "@/lib/server/auth";
import { PLATFORM_SITE_SETTING_KEY } from "@/lib/server/site-settings";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

export default async function AdminSystemSettingsPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/system`);
  const prisma = getPrismaClient();

  const settings = prisma
    ? await prisma.siteSetting.findUnique({
        where: { key: PLATFORM_SITE_SETTING_KEY },
      })
    : null;

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{params.locale === "zh" ? "系统管理" : "System settings"}</span>
          <h1>{params.locale === "zh" ? "站点品牌与基础信息" : "Branding and site profile"}</h1>
        </div>
        <p>
          {params.locale === "zh"
            ? "在此维护网站名称、彩色/反白 Logo、Favicon 以及联系信息。保存后会同步影响站点头部与页脚展示。"
            : "Manage site name, color/mono logos, favicon, and support profile. Saved values are reflected in site header and footer."}
        </p>
      </div>

      <AdminSystemSettingsClient initialSettings={settings} locale={params.locale} />
      <AdminSystemDiagnosticsClient locale={params.locale} />
    </>
  );
}
