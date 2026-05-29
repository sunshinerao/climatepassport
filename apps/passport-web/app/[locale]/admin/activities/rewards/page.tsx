import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

export default async function AdminActivitiesRewardsPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/activities/rewards`);

  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");
  const rules = await prisma.activityRewardRule.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      activity: { select: { id: true, title: true } },
    },
  });

  const zh = params.locale === "zh";

  return (
    <div>
      <div className="section-header">
        <h1 className="label">{zh ? "奖励规则" : "Reward Rules"}</h1>
        <p className="brand-subtitle">{zh ? `共 ${rules.length} 条规则` : `${rules.length} rules configured`}</p>
      </div>
      <div className="section">
        <div >
          <table className="tableish">
            <thead>
              <tr>
                <th>{zh ? "活动" : "Activity"}</th>
                <th>{zh ? "触发条件" : "Trigger"}</th>
                <th>{zh ? "奖励类型" : "Reward Type"}</th>
                <th>{zh ? "奖励值" : "Value"}</th>
                <th>{zh ? "创建时间" : "Created"}</th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-muted)" }}>
                    {zh ? "暂无规则" : "No rules configured"}
                  </td>
                </tr>
              ) : (
                rules.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <a href={`/${params.locale}/admin/activities/${r.activityId}`}>{r.activity?.title ?? r.activityId}</a>
                    </td>
                    <td><span className="chip chip">{r.trigger}</span></td>
                    <td><span className="chip">{r.rewardType}</span></td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.85em" }}>{JSON.stringify(r.rewardValueJson)}</td>
                    <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
