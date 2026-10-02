import { unstable_noStore as noStore } from "next/cache";
import { CHANNEL_SCOPE_VALUES } from "@climate-passport/passport-contracts";
import { AdminChannelClientsManager } from "@/components/admin-channel-clients-manager";
import { MACHINE_KEY_MAX_VALID_DAYS, RATE_LIMIT_BOUNDS } from "@/lib/server/channel-client-auth";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

export default async function LocalizedAdminChannelClientsPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/channel-clients`);
  const prisma = getPrismaClient();

  const programmes = prisma
    ? await prisma.programme.findMany({
        where: { isActive: true },
        orderBy: { key: "asc" },
        select: { id: true, key: true, name: true, nameEn: true },
      })
    : [];

  // 客户端列表由组件向 `/api/admin/channel-clients` 取，不在这里查库：
  // 那唯一一处「摘掉摘要列」的投影已经存在于路由里，重复一份等于多一个会漏密钥的地方。
  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{params.locale === "zh" ? "渠道客户端与密钥" : "Channel clients and keys"}</span>
          <h1>{params.locale === "zh" ? "对外 Open API 的凭据登记" : "Outward Open API credential registry"}</h1>
        </div>
        <p>
          {params.locale === "zh"
            ? "按 Programme 与类型筛选已登记的机器客户端，授予 scope、设定来源白名单与每把 key 的限流配额，并管理密钥的轮换与撤销。机密只在创建或轮换的响应中出现一次，任何列表都不会再返回它。"
            : "Filter registered machine clients by programme and type, grant scopes, set the source allowlists and per-key rate limit, then rotate or revoke keys. A secret appears exactly once in the create or rotate response and no listing ever returns it."}
        </p>
      </div>

      <AdminChannelClientsManager
        keyPolicy={{ maxValidDays: MACHINE_KEY_MAX_VALID_DAYS, rateLimitBounds: RATE_LIMIT_BOUNDS }}
        locale={params.locale}
        programmes={programmes}
        scopeCatalog={[...CHANNEL_SCOPE_VALUES]}
      />
    </>
  );
}
