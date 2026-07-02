import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

export default async function DashboardPointsPage({ params }: { params: { locale: Locale } }) {
  noStore();
  const user = await requireAuthenticatedUser(params.locale, `/${params.locale}/dashboard/points`);

  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");

  const [transactions, userRecord] = await Promise.all([
    prisma.pointTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        event: { select: { id: true, title: true, titleEn: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { points: true },
    }),
  ]);

  // Group by activityId / eventId for summary
  const activitySummaryMap = new Map<string, { label: string; total: number; count: number }>();
  const eventSummaryMap = new Map<string, { label: string; total: number; count: number }>();
  let activityTxTotal = 0;
  let eventTxTotal = 0;
  let miscTxTotal = 0;

  for (const tx of transactions) {
    if (tx.activityId) {
      const key = tx.activityId;
      const existing = activitySummaryMap.get(key) ?? { label: tx.activityId, total: 0, count: 0 };
      activitySummaryMap.set(key, { ...existing, total: existing.total + tx.points, count: existing.count + 1 });
      activityTxTotal += tx.points;
    } else if (tx.eventId && tx.event) {
      const key = tx.eventId;
      const label = params.locale === "zh" ? tx.event.title : (tx.event.titleEn ?? tx.event.title);
      const existing = eventSummaryMap.get(key) ?? { label, total: 0, count: 0 };
      eventSummaryMap.set(key, { ...existing, total: existing.total + tx.points, count: existing.count + 1 });
      eventTxTotal += tx.points;
    } else {
      miscTxTotal += tx.points;
    }
  }

  const zh = params.locale === "zh";
  const totalPoints = userRecord?.points ?? 0;

  return (
    <div className="page">
      <nav >
        <Link href={`/${params.locale}/dashboard`}>{zh ? "工作台" : "Dashboard"}</Link>
        <span>›</span>
        <span>{zh ? "积分历史" : "Points History"}</span>
      </nav>

      <div className="section-header">
        <h1 className="label">{zh ? "积分历史" : "Points History"}</h1>
      </div>

      <div className="metric-grid" style={{ marginBottom: "2rem" }}>
        <div className="data-card">
          <div >{totalPoints}</div>
          <div >{zh ? "当前总积分" : "Total Points"}</div>
        </div>
        <div className="data-card">
          <div >{transactions.length}</div>
          <div >{zh ? "交易总数" : "Total Transactions"}</div>
        </div>
        <div className="data-card">
          <div >{activityTxTotal}</div>
          <div >{zh ? "活动积分" : "From Activities"}</div>
        </div>
        <div className="data-card">
          <div >{eventTxTotal}</div>
          <div >{zh ? "活动 (Event) 积分" : "From Events"}</div>
        </div>
      </div>

      {activitySummaryMap.size > 0 && (
        <div className="section">
          <h2 className="section-header">{zh ? "按活动汇总" : "Activity Summary"}</h2>
          <div >
            <table className="tableish">
              <thead>
                <tr>
                  <th>{zh ? "活动 ID" : "Activity ID"}</th>
                  <th>{zh ? "积分小计" : "Points"}</th>
                  <th>{zh ? "记录数" : "Records"}</th>
                  <th>{zh ? "操作" : "Action"}</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(activitySummaryMap.entries()).map(([id, { total, count }]) => (
                  <tr key={id}>
                    <td style={{ fontFamily: "var(--cp-font-mono)", fontSize: "var(--cp-text-small)" }}>{id}</td>
                    <td><strong>{total > 0 ? `+${total}` : total}</strong></td>
                    <td>{count}</td>
                    <td>
                      <Link href={`/${params.locale}/dashboard/my-activities`} className="button button">
                        {zh ? "查看活动" : "View"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="section">
        <h2 className="section-header">{zh ? "积分明细" : "Transaction Details"}</h2>

        {transactions.length === 0 ? (
          <div className="form-error form-success">
            {zh ? "暂无积分记录" : "No point transactions yet"}
          </div>
        ) : (
          <div >
            <table className="tableish">
              <thead>
                <tr>
                  <th>{zh ? "时间" : "Date"}</th>
                  <th>{zh ? "类型" : "Type"}</th>
                  <th>{zh ? "描述" : "Description"}</th>
                  <th>{zh ? "关联" : "Source"}</th>
                  <th style={{ textAlign: "right" }}>{zh ? "积分" : "Points"}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td style={{ whiteSpace: "nowrap", fontSize: "var(--cp-text-small)" }}>
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <span className="chip chip">{tx.type}</span>
                    </td>
                    <td>{tx.description}</td>
                    <td style={{ fontSize: "var(--cp-text-small)", color: "var(--color-text-muted)" }}>
                      {tx.activityId
                        ? (zh ? "活动" : "Activity")
                        : tx.event
                          ? (zh ? tx.event.title : (tx.event.titleEn ?? tx.event.title))
                          : "—"}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontWeight: 600,
                        color: tx.points >= 0 ? "var(--color-success, #16a34a)" : "var(--color-error, #dc2626)",
                      }}
                    >
                      {tx.points >= 0 ? `+${tx.points}` : tx.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="section">
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link href={`/${params.locale}/dashboard`} className="button button">
            {zh ? "← 返回工作台" : "← Back to dashboard"}
          </Link>
          <Link href={`/${params.locale}/dashboard/my-activities`} className="button button">
            {zh ? "我的活动" : "My activities"}
          </Link>
        </div>
      </div>
    </div>
  );
}
