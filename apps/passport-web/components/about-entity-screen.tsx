import type { Locale } from "@/lib/site-content";

type AboutSection = {
  id: string;
  title: string;
  lead?: string;
  paragraphs?: string[];
  bullets?: string[];
};

const definitionEn = "Climate Passport is an AI-driven trusted digital identity infrastructure for the climate era, designed to turn climate learning, participation, credentials and action into a verifiable, portable and continuously growing digital profile.";
const definitionZh = "Climate Passport 是面向气候时代的 AI 驱动可信数字身份基础设施，将个人的气候学习、参与、资质与行动转化为可验证、可携带并持续成长的数字档案。";

const enSections: AboutSection[] = [
  {
    id: "entity-definition",
    title: "1. Entity definition",
    lead: definitionEn,
    paragraphs: [
      "The platform is designed as infrastructure rather than a single campaign page. It gives people, organizers, institutions, and partner programs a shared way to connect climate-related identity, learning, participation, credentials, and action records.",
    ],
  },
  {
    id: "climate-passport-id",
    title: "2. Climate Passport ID",
    lead: "A Climate Passport ID is the persistent identity anchor for a user's Climate Passport profile.",
    bullets: [
      "It connects account identity with participation, learning, credentials, verification events, and achievement records.",
      "It supports QR-based lookup and verification flows where authorized by the platform experience.",
      "It is intended to make records portable across connected climate programs and partner channels without fragmenting a user's growth profile.",
    ],
  },
  {
    id: "verifiable-credentials",
    title: "3. Verifiable credentials",
    paragraphs: [
      "Climate Passport credentials represent records such as participation, learning milestones, certificates, achievements, and other recognized climate-related outcomes.",
      "They are designed to be portable, shareable, and easier for institutions and organizations to verify through public verification flows and platform-controlled record integrity.",
    ],
  },
  {
    id: "growth-profile",
    title: "4. Continuously growing digital profile",
    paragraphs: [
      "A Climate Passport profile is not limited to a static certificate wallet. It grows as a user attends events, completes learning, earns credentials, records achievements, and participates in climate action.",
      "This makes the profile useful as a long-term record of climate capability, participation, and contribution.",
    ],
  },
  {
    id: "institutional-use",
    title: "5. Institutional and partner use",
    paragraphs: [
      "Partner channels can present Climate Passport-powered flows for registration, participation, certificates, and verification while relying on the platform as the shared identity and record layer.",
      "The goal is to reduce fragmented records and make climate participation easier to recognize across programs, organizations, and regions.",
    ],
  },
];

const zhSections: AboutSection[] = [
  {
    id: "entity-definition",
    title: "1. 实体定义",
    lead: definitionZh,
    paragraphs: [
      "Climate Passport 不是单一宣传页面，而是一套基础设施：为个人、活动组织方、机构和合作项目提供共同方式，连接气候相关身份、学习、参与、资质与行动记录。",
    ],
  },
  {
    id: "climate-passport-id",
    title: "2. Climate Passport ID",
    lead: "Climate Passport ID 是用户 Climate Passport 档案的持续身份锚点。",
    bullets: [
      "它将账户身份与参与记录、学习记录、资质凭证、验证事件和成就记录连接起来。",
      "在平台授权的使用场景中，它支持基于二维码的查询与验证流程。",
      "它的目标是在连接的气候项目与合作渠道之间保持记录可携带，避免用户成长档案被割裂。",
    ],
  },
  {
    id: "verifiable-credentials",
    title: "3. 可验证资质",
    paragraphs: [
      "Climate Passport 的资质记录包括参与证明、学习里程碑、证书、成就以及其他被认可的气候相关成果。",
      "这些记录被设计为可携带、可分享，并更便于机构和组织通过公开验证流程与平台记录完整性进行核验。",
    ],
  },
  {
    id: "growth-profile",
    title: "4. 持续成长的数字档案",
    paragraphs: [
      "Climate Passport 档案不是静态证书钱包。它会随着用户参加活动、完成学习、获得资质、记录成就并参与气候行动而持续成长。",
      "因此，这份档案可以作为长期记录气候能力、参与和贡献的可信资料。",
    ],
  },
  {
    id: "institutional-use",
    title: "5. 机构与合作方使用方式",
    paragraphs: [
      "合作渠道可以承载由 Climate Passport 支持的注册、参与、证书和验证流程，同时把平台作为共享身份与记录层。",
      "目标是减少分散记录，让气候参与更容易在项目、组织与地区之间被识别和核验。",
    ],
  },
];

function getSections(locale: Locale) {
  return locale === "zh" ? zhSections : enSections;
}

export function AboutEntityScreen({ locale }: { locale: Locale }) {
  const isZh = locale === "zh";
  const sections = getSections(locale);

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{isZh ? "实体定义" : "Entity Definition"}</span>
          <h1>What is Climate Passport?</h1>
        </div>
        <p>{isZh ? definitionZh : definitionEn}</p>
      </div>

      <section className="section privacy-policy-content">
        {sections.map((section) => (
          <article key={section.id} className="panel privacy-policy-section" id={section.id}>
            <h3>{section.title}</h3>
            {section.lead ? <p className="privacy-policy-lead">{section.lead}</p> : null}
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.bullets?.length ? (
              <ul className="privacy-policy-list">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </section>
    </>
  );
}