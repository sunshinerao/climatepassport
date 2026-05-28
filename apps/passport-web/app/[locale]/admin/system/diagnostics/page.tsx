import { unstable_noStore as noStore } from "next/cache";
import { AdminSystemDiagnosticsClient } from "@/components/admin-system-diagnostics-client";
import { requireRoleAccess } from "@/lib/server/auth";
import type { Locale } from "@/lib/site-content";

export default async function AdminSystemDiagnosticsPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/system/diagnostics`);

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{params.locale === "zh" ? "系统管理" : "System settings"}</span>
          <h1>{params.locale === "zh" ? "性能诊断" : "Performance diagnostics"}</h1>
        </div>
        <p>
          {params.locale === "zh"
            ? "实时检测当前访问的网络延迟、应用服务器处理速度与数据库连接延迟，帮助判断访问速度瓶颈所在。"
            : "Run a one-shot check to measure network latency, app server processing time, and database connection speed from your current location."}
        </p>
      </div>

      <AdminSystemDiagnosticsClient locale={params.locale} />
    </>
  );
}
