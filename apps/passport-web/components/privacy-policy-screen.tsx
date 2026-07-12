import type { Locale } from "@/lib/site-content";

type TableRow = {
  category: string;
  example: string;
  purpose: string;
};

type PolicySection = {
  id: string;
  title: string;
  lead?: string;
  paragraphs?: string[];
  bullets?: string[];
  table?: TableRow[];
};

const zhSections: PolicySection[] = [
  {
    id: "overview",
    title: "1. 我们的隐私承诺",
    lead:
      "Climate Passport 是面向气候时代的 AI 驱动可信数字身份基础设施，将个人的气候学习、参与、资质与行动转化为可验证、可携带并持续成长的数字档案。我们相信，个人在学习、行动、证书、项目参与和国际合作中形成的数据，应受到尊重、保护和负责任的使用。",
    bullets: [
      "合法、正当、透明：在处理前尽可能清晰说明目的、范围和方式。",
      "目的限定与最小必要：仅处理实现服务所必需的信息。",
      "安全、尊重与问责：提供访问、更正、删除、撤回同意等权利路径。",
    ],
    paragraphs: [
      "除法律法规要求、项目执行所必需，或经你另行明确同意外，我们不会出售你的个人信息，也不会将其用于与本项目或平台服务无关的商业广告、定向营销、通用 AI 模型训练或不透明的自动化决策。",
    ],
  },
  {
    id: "scope",
    title: "2. 适用范围",
    paragraphs: [
      "本政策适用于你使用 Climate Passport 网站、项目申请页面、活动报名页面、证书与成就管理功能、学习项目与相关沟通服务时，我们对个人信息的处理。",
      "本政策也适用于 Climate Passport 相关主办/承办机构，以及经授权参与项目执行的必要合作方在 Climate Passport 服务场景下对个人信息的处理。",
      "若某一项目设有单独隐私说明，该等专项说明将与本政策共同适用；如不一致，以更具体、对你权利保护更充分的说明为准。",
    ],
  },
  {
    id: "controller",
    title: "3. 个人信息处理者",
    bullets: [
      "Climate Passport：负责账户、Climate Passport ID、证书、申请与平台通知等处理。",
      "Climate Passport 相关主办/承办机构：在项目筛选、组织、通知、证书签发中可能作为共同处理方或独立处理方。",
      "项目必要合作方：包括评审专家、课程导师、承办机构、技术服务商等，处理范围限于项目执行所必需。",
    ],
  },
  {
    id: "collection",
    title: "4. 我们收集的信息",
    paragraphs: [
      "我们会根据具体功能和项目要求收集必要信息，不会要求你提供与服务目的无关的信息。",
    ],
    table: [
      {
        category: "身份与联系信息",
        example: "姓名、邮箱、手机号、国家/地区",
        purpose: "账户创建、身份确认、项目沟通、安全联络",
      },
      {
        category: "教育与背景信息",
        example: "学校、年级、语言能力、项目经验",
        purpose: "申请审核、项目匹配、学习建议",
      },
      {
        category: "申请与项目材料",
        example: "申请表内容、问答、作品、评审意见",
        purpose: "筛选录取、候补管理、项目组织",
      },
      {
        category: "账户与平台信息",
        example: "Climate Passport ID、登录记录、账户状态",
        purpose: "账号管理、平台安全、身份认证",
      },
      {
        category: "证书与活动记录",
        example: "证书编号、参与记录、学习进度",
        purpose: "证书签发、能力档案、里程碑管理",
      },
      {
        category: "技术与设备信息",
        example: "IP、设备类型、浏览器、访问日志",
        purpose: "安全防护、故障排查、体验优化",
      },
    ],
  },
  {
    id: "purposes",
    title: "5. 使用目的与法律基础",
    bullets: [
      "创建、验证和管理 Climate Passport 账户及 Climate Passport ID。",
      "处理夏校/学习项目/活动申请、评审、录取与候补管理。",
      "发送项目通知、录取信息、日程提醒、证书信息和必要服务沟通。",
      "组织项目执行，包括签到、身份核验、安全管理、导师沟通与证书签发。",
      "维护平台安全，预防欺诈、滥用和未经授权访问。",
    ],
    paragraphs: [
      "在适用法律下，处理依据可能包括：你的同意、履行合同或申请前步骤、履行法定义务、保护重大利益、公共利益，以及不损害你基本权利前提下的平台合法利益。",
    ],
  },
  {
    id: "minors",
    title: "6. 未成年人保护",
    paragraphs: [
      "若申请人或用户为未成年人，应在父母或法定监护人知情并同意后提交申请或使用相关服务。",
      "对于不满 14 周岁未成年人的个人信息，我们将依法取得监护人同意，并在必要范围内处理。",
      "父母或法定监护人可联系我们，申请访问、更正、删除未成年人信息，撤回同意，或限制进一步收集与使用。",
    ],
  },
  {
    id: "ai",
    title: "7. AI 与自动化处理",
    bullets: [
      "未经另行明确同意，不将夏校申请材料、未成年人信息或敏感信息用于无关商业广告或通用模型训练。",
      "如使用 AI 辅助分类或初筛，将保留必要人工审核。",
      "用于评估与改进时优先采用匿名化、去标识化或聚合统计方式。",
    ],
  },
  {
    id: "sharing",
    title: "8. 共享、委托处理与第三方",
    paragraphs: [
      "我们不会出售你的个人信息。仅在项目执行所必需、法律要求，或经你明确同意时共享或披露。",
    ],
    bullets: [
      "项目主办/承办/合作机构：用于申请审核、录取沟通、活动组织和证书签发。",
      "评审专家、导师和项目工作人员：仅访问履职所需信息并受保密义务约束。",
      "技术服务商：包括云、邮件、短信、身份验证、证书生成等服务。",
    ],
  },
  {
    id: "transfer",
    title: "9. 跨境传输",
    paragraphs: [
      "服务可能涉及跨境合作、国际导师和云服务，因此你的信息可能在所在国家/地区以外被访问、存储或处理。",
      "如发生跨境传输，我们将依据适用法律采取评估、合同条款或其他合法机制，并要求接收方采取不低于本政策标准的保护措施。",
    ],
  },
  {
    id: "retention",
    title: "10. 保存期限",
    bullets: [
      "账户与 Climate Passport ID：账户存续期间及注销后必要留档期。",
      "申请材料：申请、评审、执行及必要争议解决期间。",
      "证书与参与记录：证书验证期及必要留档期。",
      "日志与安全记录：安全审计和故障排查所需合理期限。",
    ],
    paragraphs: [
      "当保存期限届满，或处理目的已实现、无法实现或不再必要时，我们将删除、匿名化或依法归档相关信息。",
    ],
  },
  {
    id: "security",
    title: "11. 数据安全",
    bullets: [
      "传输加密、访问控制、身份认证和权限分级。",
      "后台最小权限原则、操作日志、异常监测和漏洞修复。",
      "人员和合作方保密义务，以及必要的安全审计与事件响应。",
    ],
  },
  {
    id: "rights",
    title: "12. 你的权利",
    bullets: [
      "访问与复制",
      "更正与补充",
      "删除",
      "撤回同意",
      "限制或反对处理",
      "数据可携带（在适用法律规定条件下）",
      "投诉与申诉",
    ],
    paragraphs: [
      "为保障安全，我们可能在处理请求前进行身份核验。",
    ],
  },
  {
    id: "california",
    title: "13. 美国/加州用户补充说明",
    paragraphs: [
      "如适用相关法律，你可能享有了解、删除、更正、拒绝出售/共享、限制敏感信息使用等权利，并且不会因行使隐私权受到歧视。",
    ],
  },
  {
    id: "cookies",
    title: "14. Cookies 与类似技术",
    paragraphs: [
      "我们可能使用 Cookies、本地存储或类似技术实现登录保持、安全防护、偏好设置、访问统计与性能优化。",
      "你可通过浏览器设置管理或删除 Cookies，但部分功能可能受影响。",
    ],
  },
  {
    id: "updates",
    title: "15. 政策更新",
    paragraphs: [
      "我们可能因法律、服务、技术或合作模式变化更新本政策。重大变更将通过公告、站内通知或邮件等方式提示。",
    ],
  },
  {
    id: "contact",
    title: "16. 联系我们",
    bullets: [
      "Privacy Contact: privacy@climatepass.org",
      "General Contact: info@climatepass.org",
      "我们将在验证后于适用法律规定期限内回应。",
    ],
  },
];

const enSections: PolicySection[] = [
  {
    id: "overview",
    title: "1. Our Privacy Commitment",
    lead:
      "Climate Passport is an AI-driven trusted digital identity infrastructure for the climate era, designed to turn climate learning, participation, credentials and action into a verifiable, portable and continuously growing digital profile. We process personal data with respect, protection, and accountability.",
    bullets: [
      "Lawful, fair, and transparent processing",
      "Purpose limitation and data minimization",
      "Security controls and user rights pathways",
    ],
  },
  {
    id: "scope",
    title: "2. Scope",
    paragraphs: [
      "This policy applies to Climate Passport website features, applications, events, learning programs, credentials, and related communications.",
      "Project-specific privacy notices may also apply. Where they differ, the more specific notice applies.",
    ],
  },
  {
    id: "controller",
    title: "3. Controller / Processor Roles",
    bullets: [
      "Climate Passport for platform account and identity processing",
      "SHCW hosts/organizers for project operations",
      "Necessary delivery partners and technical processors",
    ],
  },
  {
    id: "collection",
    title: "4. Data We Collect",
    table: [
      { category: "Identity & contact", example: "Name, email, phone", purpose: "Account and communication" },
      { category: "Education background", example: "School, grade, experience", purpose: "Application review" },
      { category: "Application materials", example: "Forms, essays, portfolio", purpose: "Selection and operations" },
      { category: "Platform records", example: "Climate Passport ID, login logs", purpose: "Security and verification" },
    ],
  },
  {
    id: "purposes",
    title: "5. Purposes & Legal Bases",
    bullets: [
      "Account and Climate Passport ID management",
      "Program application, review, admission, and waitlist operations",
      "Operational communications and certificate issuance",
      "Platform security and compliance obligations",
    ],
  },
  {
    id: "minors",
    title: "6. Children and Minors",
    paragraphs: [
      "If the applicant is a minor, parent or legal guardian awareness and consent is required before submission.",
    ],
  },
  {
    id: "ai",
    title: "7. AI and Automated Processing",
    paragraphs: [
      "AI may support categorization and operations, but meaningful human review remains in decisions with significant impact.",
    ],
  },
  {
    id: "sharing",
    title: "8. Sharing and Processors",
    paragraphs: [
      "We do not sell personal data. Sharing is limited to necessary project delivery, legal compliance, or your explicit consent.",
    ],
  },
  {
    id: "transfer",
    title: "9. Cross-Border Transfers",
    paragraphs: [
      "Where transfers occur, we use legally valid mechanisms and require equivalent safeguards from recipients.",
    ],
  },
  { id: "retention", title: "10. Retention", paragraphs: ["We retain data only as long as necessary for stated purposes or legal obligations."] },
  { id: "security", title: "11. Security", paragraphs: ["We use encryption, access controls, logging, monitoring, and incident response measures."] },
  {
    id: "rights",
    title: "12. Your Rights",
    bullets: ["Access", "Correction", "Deletion", "Withdraw consent", "Objection / Restriction", "Complaint"],
  },
  { id: "california", title: "13. US/California Notice", paragraphs: ["Where applicable, you may have additional rights under state privacy laws."] },
  { id: "cookies", title: "14. Cookies", paragraphs: ["Cookies and similar technologies may be used for security, session management, and performance."] },
  { id: "updates", title: "15. Updates", paragraphs: ["We may update this policy and will provide notice for material changes."] },
  { id: "contact", title: "16. Contact", bullets: ["privacy@climatepass.org", "info@climatepass.org"] },
];

function getSections(locale: Locale) {
  return locale === "zh" ? zhSections : enSections;
}

export function PrivacyPolicyScreen({ locale }: { locale: Locale }) {
  const isZh = locale === "zh";
  const sections = getSections(locale);

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{isZh ? "隐私政策" : "Privacy Policy"}</span>
          <h1>{isZh ? "Climate Passport 隐私政策" : "Climate Passport Privacy Policy"}</h1>
        </div>
        <p>
          {isZh
            ? "本政策说明 Climate Passport 如何在教育项目、活动申请、证书签发、可持续行动记录和数字身份服务中收集、使用、共享、保存与保护个人信息。"
            : "This policy explains how Climate Passport collects, uses, shares, retains, and protects personal data across applications, programs, credentials, and identity services."}
        </p>
      </div>

      <section className="section privacy-policy-content">
        {sections.map((section) => (
          <article key={section.id} className="panel privacy-policy-section" id={section.id}>
            <h3>{section.title}</h3>
            {section.lead ? <p className="privacy-policy-lead">{section.lead}</p> : null}
            {section.paragraphs?.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {section.bullets?.length ? (
              <ul className="privacy-policy-list">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : null}
            {section.table?.length ? (
              <div className="privacy-policy-table-wrap">
                <table className="privacy-policy-table">
                  <thead>
                    <tr>
                      <th>{isZh ? "信息类别" : "Category"}</th>
                      <th>{isZh ? "示例" : "Examples"}</th>
                      <th>{isZh ? "主要用途" : "Primary purpose"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.table.map((row) => (
                      <tr key={`${row.category}-${row.example}`}>
                        <td>{row.category}</td>
                        <td>{row.example}</td>
                        <td>{row.purpose}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </>
  );
}
