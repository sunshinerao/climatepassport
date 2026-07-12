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

const topicContent: Record<EntityTopicKey, Record<Locale, TopicContent>> = {
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
    fr: {
      label: "Climate Passport ID",
      title: "Qu'est-ce qu'un Climate Passport ID ?",
      intro: "Le Climate Passport ID est l'ancre d'identite persistante d'un profil Climate Passport. Il relie la propriete du compte, l'apprentissage climatique, la participation, les justificatifs, les evenements de verification et les realisations dans un dossier portable.",
      sections: [
        {
          id: "definition",
          title: "1. Definition",
          lead: "Le Climate Passport ID est un identifiant d'identite de plateforme, pas un document d'identite legal.",
          paragraphs: [
            "Il aide Climate Passport a relier le profil d'une personne, l'identite QR, la participation aux evenements, les dossiers d'apprentissage, les certificats et l'historique des realisations dans les workflows pris en charge.",
          ],
        },
        {
          id: "uses",
          title: "2. Ce qu'il relie",
          bullets: [
            "Propriete du compte et continuite du profil",
            "Inscription, check-in et dossiers de participation aux evenements",
            "Resultats d'apprentissage, de justificatifs et de certificats",
            "Recherche par QR code et workflows de verification lorsque cela est autorise",
          ],
        },
        {
          id: "boundary",
          title: "3. Limite d'identite",
          lead: "Climate Passport n'est pas une identite delivree par un gouvernement, un justificatif d'identite national ou un document de voyage.",
          paragraphs: [
            "Un Climate Passport ID est utilise dans les services Climate Passport et les workflows partenaires connectes. Il ne remplace pas un passeport, une carte nationale d'identite, un visa, un permis de residence ou tout document officiel emis par une autorite publique.",
          ],
        },
      ],
    },
    de: {
      label: "Climate Passport ID",
      title: "Was ist eine Climate Passport ID?",
      intro: "Die Climate Passport ID ist der dauerhafte Identitatsanker fur ein Climate Passport Profil. Sie verbindet Kontoinhaberschaft, klimabezogenes Lernen, Teilnahme, Nachweise, Verifizierungsereignisse und Leistungen in einem portablen Datensatz.",
      sections: [
        {
          id: "definition",
          title: "1. Definition",
          lead: "Die Climate Passport ID ist eine Plattform-Identitatskennung, kein rechtliches Identitatsdokument.",
          paragraphs: [
            "Sie hilft Climate Passport, Profil, QR-Identitat, Veranstaltungsteilnahme, Lernnachweise, Zertifikatsdatensatze und Leistungshistorie uber unterstutzte Plattformablaufe hinweg zu verbinden.",
          ],
        },
        {
          id: "uses",
          title: "2. Was sie verbindet",
          bullets: [
            "Kontoinhaberschaft und Profilkontinuitat",
            "Veranstaltungsregistrierung, Check-in und Teilnahmedatensatze",
            "Lern-, Nachweis- und Zertifikatsergebnisse",
            "QR-basierte Suche und Verifizierungsablaufe, sofern autorisiert",
          ],
        },
        {
          id: "boundary",
          title: "3. Identitatsgrenze",
          lead: "Climate Passport ist keine staatlich ausgestellte Identitat, kein nationaler Identitatsnachweis und kein Reisedokument.",
          paragraphs: [
            "Eine Climate Passport ID wird innerhalb der Climate Passport Dienste und verbundener Partnerablaufe verwendet. Sie ersetzt keinen Reisepass, Personalausweis, kein Visum, keine Aufenthaltserlaubnis und kein offizielles Dokument einer offentlichen Stelle.",
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
        {
          id: "identity-boundary",
          title: "4. Identity boundary",
          paragraphs: [
            "A Climate Passport verifiable credential is not a government-issued identity, national identity credential or travel document. It is a platform-supported record whose meaning depends on its issuer, recipient, record status and verification context.",
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
        {
          id: "identity-boundary",
          title: "4. 身份边界",
          paragraphs: [
            "Climate Passport 可验证资质不是政府签发的身份证明、国家身份凭证或旅行证件。它是平台支持的记录，其含义取决于签发方、接收者、记录状态和验证上下文。",
          ],
        },
      ],
    },
    fr: {
      label: "Justificatifs verifiables",
      title: "Que sont les justificatifs verifiables de Climate Passport ?",
      intro: "Les justificatifs verifiables de Climate Passport sont des dossiers relies a l'apprentissage climatique, a la participation, aux certificats, aux realisations et a l'historique d'action d'une personne. Ils sont concus pour etre portables, partageables et plus faciles a verifier par les institutions et organisations.",
      sections: [
        {
          id: "definition",
          title: "1. Definition",
          paragraphs: [
            "Un justificatif verifiable dans Climate Passport peut representer un certificat emis, un dossier de participation, un jalon d'apprentissage, une realisation ou un autre resultat climatique reconnu.",
          ],
        },
        {
          id: "verification",
          title: "2. Pourquoi la verification compte",
          bullets: [
            "Elle aide les institutions a verifier si un dossier a ete emis par un workflow Climate Passport reconnu.",
            "Elle reduit les preuves fragmentees entre evenements, programmes et certificats.",
            "Elle soutient un profil en croissance continue plutot que des documents ponctuels isoles.",
          ],
        },
        {
          id: "portability",
          title: "3. Portabilite et partage",
          paragraphs: [
            "Les justificatifs sont concus pour se connecter au parcours de progression de la personne et etre partages lorsque cela est approprie, tandis que la verification reste liee a l'integrite des dossiers controlee par la plateforme.",
          ],
        },
        {
          id: "identity-boundary",
          title: "4. Limite d'identite",
          paragraphs: [
            "Un justificatif verifiable Climate Passport n'est pas une identite delivree par un gouvernement, un justificatif d'identite national ou un document de voyage. C'est un dossier pris en charge par la plateforme, dont la signification depend de l'emetteur, du beneficiaire, du statut du dossier et du contexte de verification.",
          ],
        },
      ],
    },
    de: {
      label: "Verifizierbare Nachweise",
      title: "Was sind verifizierbare Climate Passport Nachweise?",
      intro: "Verifizierbare Climate Passport Nachweise sind Datensatze, die mit klimabezogenem Lernen, Teilnahme, Zertifikaten, Leistungen und Aktionshistorie einer Person verbunden sind. Sie sind portabel, teilbar und fur Institutionen und Organisationen leichter zu prufen.",
      sections: [
        {
          id: "definition",
          title: "1. Definition",
          paragraphs: [
            "Ein verifizierbarer Nachweis in Climate Passport kann ein ausgestelltes Zertifikat, einen Teilnahmedatensatz, einen Lernmeilenstein, eine Leistung oder ein anderes anerkanntes klimabezogenes Ergebnis darstellen.",
          ],
        },
        {
          id: "verification",
          title: "2. Warum Verifizierung wichtig ist",
          bullets: [
            "Sie hilft Institutionen zu prufen, ob ein Datensatz durch einen anerkannten Climate Passport Workflow ausgestellt wurde.",
            "Sie reduziert fragmentierte Nachweise uber Veranstaltungen, Programme und Zertifikate hinweg.",
            "Sie unterstutzt ein kontinuierlich wachsendes Profil statt isolierter Einzeldokumente.",
          ],
        },
        {
          id: "portability",
          title: "3. Portabilitat und Teilen",
          paragraphs: [
            "Nachweise sollen mit dem Entwicklungsweg der Person verbunden und bei Bedarf geteilt werden konnen, wahrend die Verifizierung an die plattformkontrollierte Integritat der Datensatze gebunden bleibt.",
          ],
        },
        {
          id: "identity-boundary",
          title: "4. Identitatsgrenze",
          paragraphs: [
            "Ein verifizierbarer Climate Passport Nachweis ist keine staatlich ausgestellte Identitat, kein nationaler Identitatsnachweis und kein Reisedokument. Er ist ein von der Plattform unterstutzter Datensatz, dessen Bedeutung von Aussteller, Empfanger, Datensatzstatus und Verifizierungskontext abhangt.",
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
            "Certificate verification confirms the status of a platform record. It does not turn a certificate into a government-issued identity, national identity credential or travel document.",
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
            "证书验证确认的是平台记录状态，不会把证书变成政府签发的身份证明、国家身份凭证或旅行证件。",
          ],
        },
      ],
    },
    fr: {
      label: "Verification des certificats",
      title: "Comment fonctionne la verification des certificats Climate Passport ?",
      intro: "La verification des certificats Climate Passport aide les participants, institutions et organisations a verifier si un dossier de certificat Climate Passport est valide et connecte a la couche de dossiers de justificatifs de la plateforme.",
      sections: [
        {
          id: "definition",
          title: "1. Definition",
          paragraphs: [
            "La verification des certificats est le processus public permettant de verifier le statut et l'integrite d'un dossier de certificat Climate Passport au moyen d'un code de verification ou d'un parcours lie a un QR code.",
          ],
        },
        {
          id: "what-it-shows",
          title: "2. Ce que la verification peut montrer",
          bullets: [
            "Si un dossier de certificat est valide, expire ou revoque",
            "Le resultat de justificatif ou de participation relie au certificat",
            "Le contexte du profil Climate Passport ou de l'ID associe au dossier lorsque cela est autorise",
          ],
        },
        {
          id: "privacy",
          title: "3. Confidentialite et limite d'acces",
          paragraphs: [
            "Les pages publiques de verification doivent confirmer l'authenticite du dossier sans exposer de donnees privees inutiles. Les URL de verification basees sur un code ou un jeton sont generees par les workflows de la plateforme et ne sont pas listees directement dans le sitemap.",
            "La verification d'un certificat confirme le statut d'un dossier de plateforme. Elle ne transforme pas un certificat en identite delivree par un gouvernement, en justificatif d'identite national ou en document de voyage.",
          ],
        },
      ],
    },
    de: {
      label: "Zertifikatsverifizierung",
      title: "Wie funktioniert die Climate Passport Zertifikatsverifizierung?",
      intro: "Die Climate Passport Zertifikatsverifizierung hilft Teilnehmenden, Institutionen und Organisationen zu prufen, ob ein Climate Passport Zertifikatsdatensatz gultig und mit der Nachweisschicht der Plattform verbunden ist.",
      sections: [
        {
          id: "definition",
          title: "1. Definition",
          paragraphs: [
            "Zertifikatsverifizierung ist der offentliche Prozess zur Prufung von Status und Integritat eines Climate Passport Zertifikatsdatensatzes uber einen Verifizierungscode oder einen QR-gestutzten Verifizierungsablauf.",
          ],
        },
        {
          id: "what-it-shows",
          title: "2. Was Verifizierung zeigen kann",
          bullets: [
            "Ob ein Zertifikatsdatensatz gultig, abgelaufen oder widerrufen ist",
            "Das mit dem Zertifikat verbundene Nachweis- oder Teilnahmeergebnis",
            "Den Profil- oder ID-Kontext von Climate Passport, der mit dem Datensatz verbunden ist, sofern erlaubt",
          ],
        },
        {
          id: "privacy",
          title: "3. Datenschutz und Zugriffsgrenze",
          paragraphs: [
            "Offentliche Verifizierungsseiten sollten die Echtheit des Datensatzes bestatigen, ohne unnotige private Profildaten offenzulegen. Code- und tokenbasierte Verifizierungs-URLs werden durch Plattformablaufe erzeugt und nicht direkt im Sitemap gelistet.",
            "Die Zertifikatsverifizierung bestatigt den Status eines Plattformdatensatzes. Sie macht ein Zertifikat nicht zu einer staatlich ausgestellten Identitat, einem nationalen Identitatsnachweis oder einem Reisedokument.",
          ],
        },
      ],
    },
  },
};

export function getEntityTopicContent(topic: EntityTopicKey, locale: Locale) {
  return topicContent[topic][locale];
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