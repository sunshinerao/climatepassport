import type { Locale } from "@/lib/site-content";

export type EntityTopicKey = "certificate-verification" | "climate-passport-id" | "verifiable-credentials";

type TopicSection = {
  id: string;
  title: string;
  lead?: string;
  paragraphs?: string[];
  bullets?: string[];
};

type TopicContent = {
  label: string;
  title: string;
  intro: string;
  sections: TopicSection[];
};

const topicContent: Record<EntityTopicKey, { en: TopicContent; zh: TopicContent }> = {
  "climate-passport-id": {
    en: {
      label: "Climate Passport ID",
      title: "What is Climate Passport ID?",
      intro: "Climate Passport ID is the persistent identity anchor for a Climate Passport profile, connecting account ownership, climate learning, participation, credentials, verification events and achievements into one portable record.",
      sections: [
        {
          id: "definition",
          title: "1. Definition",
          lead: "Climate Passport ID is a platform identity identifier, not a legal identity document.",
          paragraphs: [
            "It helps Climate Passport connect a user's profile, QR identity, event participation, learning records, certificate records, and achievement history across supported platform workflows.",
          ],
        },
        {
          id: "uses",
          title: "2. What it connects",
          bullets: [
            "Account ownership and profile continuity",
            "Event registration, check-in and participation records",
            "Learning, credential and certificate outcomes",
            "QR-based lookup and verification workflows where authorized",
          ],
        },
        {
          id: "boundary",
          title: "3. Identity boundary",
          lead: "Climate Passport is not a government-issued identity, national identity credential or travel document.",
          paragraphs: [
            "A Climate Passport ID is used inside Climate Passport services and connected partner workflows. It does not replace a passport, national ID card, visa, residence permit or any official document issued by a public authority.",
          ],
        },
      ],
    },
    zh: {
      label: "Climate Passport ID",
      title: "什么是 Climate Passport ID？",
      intro: "Climate Passport ID 是 Climate Passport 档案的持续身份锚点，将账户归属、气候学习、参与、资质、验证事件和成就连接为一份可携带记录。",
      sections: [
        {
          id: "definition",
          title: "1. 定义",
          lead: "Climate Passport ID 是平台身份标识，不是法定身份证件。",
          paragraphs: [
            "它帮助 Climate Passport 在平台流程中连接用户档案、二维码身份、活动参与、学习记录、证书记录和成就历史。",
          ],
        },
        {
          id: "uses",
          title: "2. 它连接什么",
          bullets: [
            "账户归属与档案连续性",
            "活动报名、签到与参与记录",
            "学习、资质与证书成果",
            "在授权场景下的二维码查询与验证流程",
          ],
        },
        {
          id: "boundary",
          title: "3. 身份边界",
          lead: "Climate Passport 不是政府签发的身份证明、国家身份凭证或旅行证件。",
          paragraphs: [
            "Climate Passport ID 仅用于 Climate Passport 服务与连接的合作流程，不替代护照、身份证、签证、居留许可或任何公共机关签发的官方文件。",
          ],
        },
      ],
    },
  },
  "verifiable-credentials": {
    en: {
      label: "Verifiable credentials",
      title: "What are Climate Passport verifiable credentials?",
      intro: "Climate Passport verifiable credentials are records connected to a user's climate learning, participation, certificates, achievements and action history, designed to be portable, shareable and easier for institutions and organizations to verify.",
      sections: [
        {
          id: "definition",
          title: "1. Definition",
          paragraphs: [
            "A verifiable credential in Climate Passport can represent an issued certificate, participation record, learning milestone, achievement, or other recognized climate-related outcome.",
          ],
        },
        {
          id: "verification",
          title: "2. Why verification matters",
          bullets: [
            "It helps institutions check whether a record was issued through a recognized Climate Passport workflow.",
            "It reduces fragmented proof across events, programs and certificates.",
            "It supports a continuously growing profile rather than isolated one-time documents.",
          ],
        },
        {
          id: "portability",
          title: "3. Portability and sharing",
          paragraphs: [
            "Credentials are designed to connect to the user's growth path and be shared where appropriate, while verification remains tied to platform-controlled record integrity.",
          ],
        },
      ],
    },
    zh: {
      label: "可验证资质",
      title: "什么是 Climate Passport 可验证资质？",
      intro: "Climate Passport 可验证资质是连接个人气候学习、参与、证书、成就与行动历史的记录，设计为可携带、可分享，并更便于机构和组织核验。",
      sections: [
        {
          id: "definition",
          title: "1. 定义",
          paragraphs: [
            "Climate Passport 中的可验证资质可以代表已签发证书、参与记录、学习里程碑、成就或其他被认可的气候相关成果。",
          ],
        },
        {
          id: "verification",
          title: "2. 为什么需要验证",
          bullets: [
            "帮助机构确认某项记录是否通过认可的 Climate Passport 流程签发。",
            "减少活动、项目和证书之间分散证明带来的摩擦。",
            "支持持续成长的个人档案，而不是孤立的一次性文件。",
          ],
        },
        {
          id: "portability",
          title: "3. 可携带与分享",
          paragraphs: [
            "资质记录被设计为连接用户成长路径，并可在适当场景下分享；核验仍然基于平台控制的记录完整性。",
          ],
        },
      ],
    },
  },
  "certificate-verification": {
    en: {
      label: "Certificate verification",
      title: "How does Climate Passport certificate verification work?",
      intro: "Climate Passport certificate verification helps participants, institutions and organizations check whether a Climate Passport certificate record is valid and connected to the platform's credential record layer.",
      sections: [
        {
          id: "definition",
          title: "1. Definition",
          paragraphs: [
            "Certificate verification is the public-facing process for checking the status and integrity of a Climate Passport certificate record through a verification code or QR-linked verification flow.",
          ],
        },
        {
          id: "what-it-shows",
          title: "2. What verification can show",
          bullets: [
            "Whether a certificate record is valid, expired or revoked",
            "The credential or participation outcome connected to the certificate",
            "The Climate Passport profile or ID context associated with the record where permitted",
          ],
        },
        {
          id: "privacy",
          title: "3. Privacy and access boundary",
          paragraphs: [
            "Public verification pages should confirm record authenticity without exposing unnecessary private profile data. Code-based and token-based verification URLs are generated by platform workflows and are not listed directly in the sitemap.",
          ],
        },
      ],
    },
    zh: {
      label: "证书验证",
      title: "Climate Passport 证书验证如何工作？",
      intro: "Climate Passport 证书验证帮助参与者、机构和组织确认 Climate Passport 证书记录是否有效，并是否连接到平台的资质记录层。",
      sections: [
        {
          id: "definition",
          title: "1. 定义",
          paragraphs: [
            "证书验证是通过验证码或二维码验证流程，公开查询 Climate Passport 证书记录状态与完整性的过程。",
          ],
        },
        {
          id: "what-it-shows",
          title: "2. 验证可以展示什么",
          bullets: [
            "证书记录是否有效、过期或撤销",
            "证书关联的资质或参与成果",
            "在允许范围内展示与该记录相关的 Climate Passport 档案或 ID 背景",
          ],
        },
        {
          id: "privacy",
          title: "3. 隐私与访问边界",
          paragraphs: [
            "公开验证页面应确认记录真实性，同时避免暴露不必要的个人档案数据。基于 code 或 token 的验证详情 URL 由平台流程生成，不直接列入 sitemap。",
          ],
        },
      ],
    },
  },
};

export function getEntityTopicContent(topic: EntityTopicKey, locale: Locale) {
  return locale === "zh" ? topicContent[topic].zh : topicContent[topic].en;
}

export function EntityTopicScreen({ locale, topic }: { locale: Locale; topic: EntityTopicKey }) {
  const content = getEntityTopicContent(topic, locale);

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{content.label}</span>
          <h1>{content.title}</h1>
        </div>
        <p>{content.intro}</p>
      </div>

      <section className="section privacy-policy-content">
        {content.sections.map((section) => (
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