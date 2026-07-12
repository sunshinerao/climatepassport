import Link from "next/link";
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
const definitionFr = "Climate Passport est une infrastructure d'identite numerique fiable, pilotee par l'IA, pour l'ere climatique. Elle transforme l'apprentissage, la participation, les justificatifs et l'action climatiques en un profil numerique verifiable, portable et en croissance continue.";
const definitionDe = "Climate Passport ist eine KI-gestutzte Infrastruktur fur vertrauenswurdige digitale Identitat im Klimazeitalter. Sie verbindet klimabezogenes Lernen, Teilnahme, Nachweise und Handeln zu einem verifizierbaren, portablen und kontinuierlich wachsenden digitalen Profil.";
const identityBoundaryEn = "Climate Passport is not a government-issued identity, national identity credential or travel document.";
const identityBoundaryZh = "Climate Passport 不是政府签发的身份证明、国家身份凭证或旅行证件。";
const identityBoundaryFr = "Climate Passport n'est pas une identite delivree par un gouvernement, un justificatif d'identite national ou un document de voyage.";
const identityBoundaryDe = "Climate Passport ist keine staatlich ausgestellte Identitat, kein nationaler Identitatsnachweis und kein Reisedokument.";

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
    id: "identity-boundary",
    title: "3. Identity boundary",
    lead: identityBoundaryEn,
    paragraphs: [
      "The identity layer is used for platform account ownership, climate participation records, credential verification, and connected program workflows. It does not replace legal identity documents or official travel documents issued by public authorities.",
    ],
  },
  {
    id: "verifiable-credentials",
    title: "4. Verifiable credentials",
    paragraphs: [
      "Climate Passport credentials represent records such as participation, learning milestones, certificates, achievements, and other recognized climate-related outcomes.",
      "They are designed to be portable, shareable, and easier for institutions and organizations to verify through public verification flows and platform-controlled record integrity.",
    ],
  },
  {
    id: "growth-profile",
    title: "5. Continuously growing digital profile",
    paragraphs: [
      "A Climate Passport profile is not limited to a static certificate wallet. It grows as a user attends events, completes learning, earns credentials, records achievements, and participates in climate action.",
      "This makes the profile useful as a long-term record of climate capability, participation, and contribution.",
    ],
  },
  {
    id: "institutional-use",
    title: "6. Institutional and partner use",
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
    id: "identity-boundary",
    title: "3. 身份边界",
    lead: identityBoundaryZh,
    paragraphs: [
      "该身份层用于平台账户归属、气候参与记录、资质核验和连接项目流程，不替代公共机关签发的法定身份证件或官方旅行证件。",
    ],
  },
  {
    id: "verifiable-credentials",
    title: "4. 可验证资质",
    paragraphs: [
      "Climate Passport 的资质记录包括参与证明、学习里程碑、证书、成就以及其他被认可的气候相关成果。",
      "这些记录被设计为可携带、可分享，并更便于机构和组织通过公开验证流程与平台记录完整性进行核验。",
    ],
  },
  {
    id: "growth-profile",
    title: "5. 持续成长的数字档案",
    paragraphs: [
      "Climate Passport 档案不是静态证书钱包。它会随着用户参加活动、完成学习、获得资质、记录成就并参与气候行动而持续成长。",
      "因此，这份档案可以作为长期记录气候能力、参与和贡献的可信资料。",
    ],
  },
  {
    id: "institutional-use",
    title: "6. 机构与合作方使用方式",
    paragraphs: [
      "合作渠道可以承载由 Climate Passport 支持的注册、参与、证书和验证流程，同时把平台作为共享身份与记录层。",
      "目标是减少分散记录，让气候参与更容易在项目、组织与地区之间被识别和核验。",
    ],
  },
];

const frSections: AboutSection[] = [
  {
    id: "entity-definition",
    title: "1. Definition de l'entite",
    lead: definitionFr,
    paragraphs: [
      "La plateforme est concue comme une infrastructure plutot que comme une simple page de campagne. Elle donne aux personnes, organisateurs, institutions et programmes partenaires une facon commune de relier identite climatique, apprentissage, participation, justificatifs et dossiers d'action.",
    ],
  },
  {
    id: "climate-passport-id",
    title: "2. Climate Passport ID",
    lead: "Un Climate Passport ID est l'ancre d'identite persistante du profil Climate Passport d'une personne.",
    bullets: [
      "Il relie l'identite du compte aux dossiers de participation, d'apprentissage, de justificatifs, de verification et de realisations.",
      "Il prend en charge les parcours de recherche et de verification par QR code lorsque l'experience de la plateforme l'autorise.",
      "Il vise a rendre les dossiers portables entre programmes climatiques connectes et canaux partenaires sans fragmenter le profil de progression d'une personne.",
    ],
  },
  {
    id: "identity-boundary",
    title: "3. Limite d'identite",
    lead: identityBoundaryFr,
    paragraphs: [
      "Cette couche d'identite sert a la propriete du compte, aux dossiers de participation climatique, a la verification des justificatifs et aux workflows de programmes connectes. Elle ne remplace pas les documents d'identite legale ni les documents de voyage officiels emis par des autorites publiques.",
    ],
  },
  {
    id: "verifiable-credentials",
    title: "4. Justificatifs verifiables",
    paragraphs: [
      "Les justificatifs Climate Passport representent des dossiers tels que la participation, les jalons d'apprentissage, les certificats, les realisations et d'autres resultats reconnus lies au climat.",
      "Ils sont concus pour etre portables, partageables et plus faciles a verifier par les institutions et organisations grace a des parcours de verification publics et a l'integrite des dossiers controles par la plateforme.",
    ],
  },
  {
    id: "growth-profile",
    title: "5. Profil numerique en croissance continue",
    paragraphs: [
      "Un profil Climate Passport ne se limite pas a un portefeuille statique de certificats. Il grandit lorsqu'une personne participe a des evenements, termine des apprentissages, obtient des justificatifs, enregistre des realisations et prend part a l'action climatique.",
      "Le profil devient ainsi utile comme dossier de long terme sur les capacites, la participation et la contribution climatiques.",
    ],
  },
  {
    id: "institutional-use",
    title: "6. Usage institutionnel et partenaire",
    paragraphs: [
      "Les canaux partenaires peuvent presenter des parcours d'inscription, de participation, de certificats et de verification propulses par Climate Passport, tout en s'appuyant sur la plateforme comme couche commune d'identite et de dossiers.",
      "L'objectif est de reduire les dossiers fragmentes et de faciliter la reconnaissance de la participation climatique entre programmes, organisations et regions.",
    ],
  },
];

const deSections: AboutSection[] = [
  {
    id: "entity-definition",
    title: "1. Entitatsdefinition",
    lead: definitionDe,
    paragraphs: [
      "Die Plattform ist als Infrastruktur konzipiert, nicht als einzelne Kampagnenseite. Sie bietet Personen, Organisatoren, Institutionen und Partnerprogrammen eine gemeinsame Methode, klimabezogene Identitat, Lernen, Teilnahme, Nachweise und Aktionsdatensatze zu verbinden.",
    ],
  },
  {
    id: "climate-passport-id",
    title: "2. Climate Passport ID",
    lead: "Eine Climate Passport ID ist der dauerhafte Identitatsanker fur das Climate Passport Profil einer Person.",
    bullets: [
      "Sie verbindet Kontoidentitat mit Teilnahme-, Lern-, Nachweis-, Verifizierungs- und Leistungsdatensatzen.",
      "Sie unterstutzt QR-basierte Such- und Verifizierungsablaufe, wenn diese durch die Plattform autorisiert sind.",
      "Sie soll Datensatze zwischen verbundenen Klimaprogrammen und Partnerkanalen portabel machen, ohne das Wachstumsprofil einer Person zu fragmentieren.",
    ],
  },
  {
    id: "identity-boundary",
    title: "3. Identitatsgrenze",
    lead: identityBoundaryDe,
    paragraphs: [
      "Diese Identitatsschicht dient Kontoinhaberschaft, klimabezogenen Teilnahmedatensatzen, Nachweisverifizierung und verbundenen Programmablaufen. Sie ersetzt keine rechtlichen Identitatsdokumente oder offiziellen Reisedokumente offentlicher Stellen.",
    ],
  },
  {
    id: "verifiable-credentials",
    title: "4. Verifizierbare Nachweise",
    paragraphs: [
      "Climate Passport Nachweise stehen fur Datensatze wie Teilnahme, Lernmeilensteine, Zertifikate, Leistungen und andere anerkannte klimabezogene Ergebnisse.",
      "Sie sind so gestaltet, dass sie portabel, teilbar und fur Institutionen und Organisationen leichter verifizierbar sind, gestutzt auf offentliche Verifizierungsablaufe und plattformkontrollierte Datensatzintegritat.",
    ],
  },
  {
    id: "growth-profile",
    title: "5. Kontinuierlich wachsendes digitales Profil",
    paragraphs: [
      "Ein Climate Passport Profil ist nicht auf eine statische Zertifikatsmappe beschrankt. Es wachst, wenn eine Person Veranstaltungen besucht, Lernangebote abschliesst, Nachweise erhalt, Leistungen dokumentiert und an Klimahandeln teilnimmt.",
      "Damit wird das Profil zu einem langfristigen Nachweis klimabezogener Fahigkeiten, Teilnahme und Beitrage.",
    ],
  },
  {
    id: "institutional-use",
    title: "6. Nutzung durch Institutionen und Partner",
    paragraphs: [
      "Partnerkanale konnen Climate Passport gestutzte Ablaufe fur Registrierung, Teilnahme, Zertifikate und Verifizierung anbieten und dabei die Plattform als gemeinsame Identitats- und Datensatzschicht nutzen.",
      "Ziel ist es, fragmentierte Nachweise zu reduzieren und klimabezogene Teilnahme uber Programme, Organisationen und Regionen hinweg leichter erkennbar zu machen.",
    ],
  },
];

function getSections(locale: Locale) {
  if (locale === "zh") {
    return zhSections;
  }

  if (locale === "fr") {
    return frSections;
  }

  if (locale === "de") {
    return deSections;
  }

  return enSections;
}

function getHeader(locale: Locale) {
  if (locale === "zh") {
    return { label: "实体定义", title: "Climate Passport 是什么？", definition: definitionZh };
  }

  if (locale === "fr") {
    return { label: "Definition de l'entite", title: "Qu'est-ce que Climate Passport ?", definition: definitionFr };
  }

  if (locale === "de") {
    return { label: "Entitatsdefinition", title: "Was ist Climate Passport?", definition: definitionDe };
  }

  return { label: "Entity Definition", title: "What is Climate Passport?", definition: definitionEn };
}

function getKnowledgeHubLinkText(locale: Locale) {
  if (locale === "zh") {
    return "阅读气候记录、气候凭证与验证的实用指南。";
  }

  if (locale === "fr") {
    return "Consulter le guide pratique des enregistrements, justificatifs et verifications climatiques.";
  }

  if (locale === "de") {
    return "Den praktischen Leitfaden zu klimabezogenen Datensatzen, Nachweisen und Verifizierung lesen.";
  }

  return "Explore the practical guide to climate records, credentials and verification.";
}

export function AboutEntityScreen({ locale }: { locale: Locale }) {
  const sections = getSections(locale);
  const header = getHeader(locale);

  return (
    <>
      <div className="section-header">
        <div>
          <span className="label">{header.label}</span>
          <h1>{header.title}</h1>
        </div>
        <p>{header.definition}</p>
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
            {section.id === "verifiable-credentials" ? (
              <p>
                <Link href={`/${locale}/climate-records-and-credentials`}>{getKnowledgeHubLinkText(locale)}</Link>
              </p>
            ) : null}
          </article>
        ))}
      </section>
    </>
  );
}