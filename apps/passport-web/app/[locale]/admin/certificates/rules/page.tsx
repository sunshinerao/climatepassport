import { unstable_noStore as noStore } from "next/cache";
import { requireRoleAccess } from "@/lib/server/auth";
import { getCertificateName } from "@/lib/server/certificate-module";
import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

export default async function AdminCertificateRulesPage({ params }: { params: { locale: Locale } }) {
  noStore();
  await requireRoleAccess(params.locale, ["ADMIN"], `/${params.locale}/admin/certificates/rules`);
  const prisma = getPrismaClient();
  const isZh = params.locale === "zh";
  const definitions = prisma
    ? await prisma.certificateDefinition.findMany({
        orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
        include: { category: true, template: true, learningExperiencePrograms: { select: { id: true, title: true, titleEn: true } } },
      })
    : [];

  const plannedRules = [
    { source: "Course", condition: "Course completion", timing: "Immediate" },
    { source: "Event", condition: "Successful check-in", timing: "After attendance confirmation" },
    { source: "Learning Experience", condition: "Program completion", timing: "After admin completion" },
    { source: "Role", condition: "Speaker, moderator, mentor, volunteer, organizer", timing: "Manual or batch" },
    { source: "Points", condition: "Threshold reached", timing: "Scheduled evaluation" },
  ];

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{isZh ? "自动签发规则" : "Issuing Rules"}</span>
          <h1>{isZh ? "证书触发条件" : "Certificate trigger conditions"}</h1>
        </div>
        <p>{isZh ? "将课程、活动签到、Learning Experience、角色贡献、积分与成就转化为可验证证书。" : "Turn courses, check-ins, Learning Experiences, role contributions, points, and achievements into verifiable credentials."}</p>
      </div>

      <section className="section certificate-card-grid">
        {definitions.map((definition) => (
          <article className="certificate-card" key={definition.id}>
            <div className="certificate-card-top">
              <span className="status-badge">{definition.isActive ? (isZh ? "启用" : "Active") : (isZh ? "停用" : "Inactive")}</span>
              <span>{definition.approvalMode}</span>
            </div>
            <h3>{getCertificateName(params.locale, definition)}</h3>
            <p>{getCertificateName(params.locale, definition.category)} · {getCertificateName(params.locale, definition.template)}</p>
            <dl className="certificate-meta-grid">
              <div><dt>{isZh ? "触发配置" : "Rule config"}</dt><dd>{definition.issueRule ? (isZh ? "已配置" : "Configured") : (isZh ? "待配置" : "Pending")}</dd></div>
              <div><dt>{isZh ? "积分奖励" : "Point reward"}</dt><dd>{definition.pointReward ?? 0}</dd></div>
              <div><dt>{isZh ? "关联项目" : "Programs"}</dt><dd>{definition.learningExperiencePrograms.length}</dd></div>
              <div><dt>{isZh ? "确认方式" : "Confirmation"}</dt><dd>{definition.approvalMode}</dd></div>
            </dl>
          </article>
        ))}
      </section>

      <section className="section panel">
        <span className="label">{isZh ? "规则蓝图" : "Rule blueprint"}</span>
        <div className="certificate-rule-list">
          {plannedRules.map((rule) => (
            <div key={rule.source}>
              <strong>{rule.source}</strong>
              <span>{rule.condition}</span>
              <small>{rule.timing}</small>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
