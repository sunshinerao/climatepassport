import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";
import AdminRewardRuleFormClient, { RewardRuleDeleteButton } from "@/components/admin-reward-rule-form-client";

export default async function AdminActivityRewardsPage({
  params,
}: {
  params: { locale: Locale; id: string };
}) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN", "EVENT_MANAGER"], `/${params.locale}/admin/activities/${params.id}/rewards`);

  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable");

  const [activity, rewardRules, certRules] = await Promise.all([
    prisma.activity.findUnique({
      where: { id: params.id },
      select: { id: true, title: true, slug: true, type: true },
    }),
    prisma.activityRewardRule.findMany({
      where: { activityId: params.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.activityCertificateRule.findMany({
      where: { activityId: params.id },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!activity) throw new Error("Activity not found");

  const zh = params.locale === "zh";

  const TRIGGER_LABELS: Record<string, string> = {
    REGISTRATION_APPROVED: zh ? "报名审核通过" : "Registration Approved",
    CHECKIN_COMPLETED: zh ? "签到完成" : "Check-in Completed",
    TASK_COMPLETED: zh ? "任务完成" : "Task Completed",
    CONSECUTIVE_CHECKIN: zh ? "连续签到" : "Consecutive Check-in",
    SUBMISSION_APPROVED: zh ? "成果审核通过" : "Submission Approved",
    COURSE_COMPLETED: zh ? "课程完成" : "Course Completed",
    PROJECT_COMPLETED: zh ? "项目完成" : "Project Completed",
    EXCELLENT_REVIEW: zh ? "优秀评审" : "Excellent Review",
    ROLE_ASSIGNED: zh ? "角色分配" : "Role Assigned",
    REFERRAL_SUCCESS: zh ? "成功推荐" : "Referral Success",
    PARTICIPATION_COMPLETED: zh ? "参与完成" : "Participation Completed",
  };

  const REWARD_TYPE_LABELS: Record<string, string> = {
    POINTS: zh ? "积分" : "Points",
    BADGE: zh ? "徽章" : "Badge",
    CERTIFICATE: zh ? "证书" : "Certificate",
    PASSPORT_ENTRY: zh ? "护照记录" : "Passport Entry",
    LEADERBOARD: zh ? "排行榜" : "Leaderboard",
    SKILL_TAG: zh ? "技能标签" : "Skill Tag",
    NOTIFICATION: zh ? "通知" : "Notification",
  };

  return (
    <div>
      <nav >
        <a href={`/${params.locale}/admin/activities`}>{zh ? "活动管理" : "Activities"}</a>
        <span>›</span>
        <a href={`/${params.locale}/admin/activities/${params.id}`}>{activity.title}</a>
        <span>›</span>
        <span>{zh ? "奖励规则" : "Reward Rules"}</span>
      </nav>

      <div className="section-header">
        <h1 className="label">{zh ? "奖励规则配置" : "Reward Rules"}</h1>
        <p className="brand-subtitle">
          {zh ? `活动：${activity.title}` : `Activity: ${activity.title}`}
        </p>
      </div>

      <div className="section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 className="section-header">{zh ? "积分 / 徽章 / 护照规则" : "Points / Badge / Passport Rules"}</h2>
          <span className="chip chip">
            {zh ? `${rewardRules.length} 条规则` : `${rewardRules.length} rules`}
          </span>
        </div>

        <AdminRewardRuleFormClient activityId={params.id} locale={params.locale} />

        {rewardRules.length === 0 ? (
          <div className="form-error form-success">
            {zh ? "该活动暂未配置奖励规则，点击上方按钮添加。" : "No reward rules yet. Use the button above to add one."}
          </div>
        ) : (
          <div >
            <table className="tableish">
              <thead>
                <tr>
                  <th>{zh ? "触发条件" : "Trigger"}</th>
                  <th>{zh ? "奖励类型" : "Reward Type"}</th>
                  <th>{zh ? "奖励值" : "Value"}</th>
                  <th>{zh ? "条件" : "Condition"}</th>
                  <th>{zh ? "创建时间" : "Created"}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rewardRules.map((rule) => (
                  <tr key={rule.id}>
                    <td>
                      <span className="chip cpca-badge cpca-badge-blue">
                        {TRIGGER_LABELS[rule.trigger] ?? rule.trigger}
                      </span>
                    </td>
                    <td>
                      <span className="chip">
                        {REWARD_TYPE_LABELS[rule.rewardType] ?? rule.rewardType}
                      </span>
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.85em" }}>
                      {JSON.stringify(rule.rewardValueJson)}
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.85em", color: "var(--color-text-muted)" }}>
                      {rule.conditionJson ? JSON.stringify(rule.conditionJson) : "—"}
                    </td>
                    <td>{new Date(rule.createdAt).toLocaleDateString()}</td>
                    <td><RewardRuleDeleteButton ruleId={rule.id} locale={params.locale} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 className="section-header">{zh ? "证书颁发规则" : "Certificate Rules"}</h2>
          <span className="chip chip">
            {zh ? `${certRules.length} 条规则` : `${certRules.length} rules`}
          </span>
        </div>

        {certRules.length === 0 ? (
          <div className="form-error form-success">
            {zh ? "该活动暂未配置证书规则。" : "No certificate rules configured for this activity."}
          </div>
        ) : (
          <div >
            <table className="tableish">
              <thead>
                <tr>
                  <th>{zh ? "证书定义 ID" : "Certificate Definition ID"}</th>
                  <th>{zh ? "自动颁发" : "Auto Issue"}</th>
                  <th>{zh ? "条件" : "Condition"}</th>
                  <th>{zh ? "创建时间" : "Created"}</th>
                </tr>
              </thead>
              <tbody>
                {certRules.map((rule) => (
                  <tr key={rule.id}>
                    <td style={{ fontFamily: "monospace", fontSize: "0.85em" }}>{rule.certificateDefinitionId}</td>
                    <td>
                      <span className={`chip ${rule.autoIssue ? "cpca-badge cpca-badge-green" : "chip"}`}>
                        {rule.autoIssue ? (zh ? "是" : "Yes") : (zh ? "否" : "No")}
                      </span>
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.85em", color: "var(--color-text-muted)" }}>
                      {rule.conditionJson ? JSON.stringify(rule.conditionJson) : "—"}
                    </td>
                    <td>{new Date(rule.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="form-error form-success" style={{ marginTop: "1rem" }}>
          <strong>{zh ? "如何添加规则：" : "To add a rule: "}</strong>
          {zh
            ? " POST /api/activity-certificate-rules，提供 activityId、certificateDefinitionId 和 autoIssue"
            : " POST /api/activity-certificate-rules with activityId, certificateDefinitionId, and autoIssue"}
        </div>
      </div>

      <div className="section">
        <h2 className="section-header">{zh ? "快速导航" : "Quick Links"}</h2>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <a href={`/${params.locale}/admin/activities/${params.id}`} className="button button">
            {zh ? "← 活动详情" : "← Activity Detail"}
          </a>
          <a href={`/${params.locale}/admin/activities/${params.id}/participations`} className="button button">
            {zh ? "参与记录" : "Participations"}
          </a>
          <a href={`/${params.locale}/admin/activities/rewards`} className="button button">
            {zh ? "全局奖励规则" : "Global Reward Rules"}
          </a>
          <a href={`/${params.locale}/admin/activities/certificates`} className="button button">
            {zh ? "全局证书规则" : "Global Certificate Rules"}
          </a>
        </div>
      </div>
    </div>
  );
}
