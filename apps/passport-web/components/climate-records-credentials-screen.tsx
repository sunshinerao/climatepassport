import Link from "next/link";
import type { Locale } from "@/lib/site-content";

export const climateRecordsHubPath = "/climate-records-and-credentials";

type KnowledgeSection = {
  id: string;
  title: string;
  lead: string;
  paragraphs: string[];
  subsections?: Array<{ title: string; body: string }>;
  bullets?: string[];
  ordered?: boolean;
};

type KnowledgeHubContent = {
  label: string;
  title: string;
  metadataTitle: string;
  description: string;
  intro: string;
  contentsTitle: string;
  contents: Array<{ href: string; label: string }>;
  sections: KnowledgeSection[];
  identityLinks: {
    climatePassportId: string;
    about: string;
  };
  relatedTitle: string;
  relatedLinks: {
    about: string;
    climatePassportId: string;
    climateCredentials: string;
    credentialVerification: string;
    climateDigitalIdentity: string;
  };
};

const content: Record<Locale, KnowledgeHubContent> = {
  en: {
    label: "Climate Passport Knowledge Hub",
    title: "Climate Records and Credentials: A Practical Guide",
    metadataTitle: "Climate Records & Credentials | Climate Passport",
    description: "A practical guide to climate credentials, verification, learning records, participation records, action records and climate digital identity.",
    intro: "Climate-related learning, participation, credentials and action are often recorded by different organizations and stored in separate formats. This guide explains the main types of climate records, how verification works, and how these records can contribute to a more portable and persistent digital profile.",
    contentsTitle: "Contents",
    contents: [
      { href: "#climate-credentials", label: "What are climate credentials?" },
      { href: "#credential-verification", label: "How verification works" },
      { href: "#climate-learning-records", label: "Climate learning records" },
      { href: "#climate-participation-records", label: "Climate participation records" },
      { href: "#climate-action-records", label: "Climate action records" },
      { href: "#climate-digital-identity", label: "Climate digital identity" },
      { href: "#how-climate-passport-connects-records", label: "How Climate Passport connects records" },
    ],
    sections: [
      {
        id: "climate-credentials",
        title: "What Are Climate Credentials?",
        lead: "Climate credentials are records of climate-related learning, skills, participation or achievement issued or confirmed by an identifiable organization.",
        paragraphs: [
          "A trustworthy climate credential should make it possible to understand who issued the record, what the credential represents, who received it, when it was issued where relevant, and how its authenticity or issuance record can be checked.",
          "The term is useful for describing climate-related records, but it should not be treated as a universally standardized legal category. A credential may be issued by a university, event organizer, professional programme, civil society initiative or other identifiable organization, depending on the context.",
        ],
        subsections: [
          { title: "What a climate credential can represent", body: "A credential can represent completion of a learning activity, participation in an eligible event, contribution to a programme, receipt of a certificate, or another recognized climate-related outcome. Its meaning depends on the issuer and the record attached to it." },
          { title: "Issuer, recipient and meaning", body: "Issuer identity, recipient identity and credential meaning are central to interpretation. A reader should be able to distinguish a record issued by an institution from a self-declared statement, and should be able to understand what the record confirms." },
        ],
      },
      {
        id: "credential-verification",
        title: "How Can Climate Credentials Be Verified?",
        lead: "Climate credentials can be verified by checking the issuer, recipient, credential identifier, issuance record and the verification information provided by the issuing system.",
        paragraphs: [
          "A useful verification process helps a third party confirm that the credential exists as an issued record and is not simply an unsupported image, screenshot or copied document. It should give enough context to understand where the record came from and what it means.",
          "A certificate image is not automatically the same as a verifiable credential record. Visual documents can represent a valid credential, but verification requires access to appropriate issuer information, issuance information or a verification system.",
        ],
        subsections: [{ title: "Common verification signals", body: "Verification usually depends on clear issuer, recipient and record context." }],
        bullets: ["Issuer identity and issuing organization context", "Recipient identity or profile context where appropriate", "Credential identifier, verification code or record identifier", "Issuance record and issue date where relevant", "Verification page or verification system", "Status or revocation information where supported"],
      },
      {
        id: "climate-learning-records",
        title: "What Is a Climate Learning Record?",
        lead: "A climate learning record is a structured record of an individual climate-related learning experience.",
        paragraphs: [
          "It may document participation in a course, workshop, summer school, professional programme, learning module or another eligible climate-related learning activity.",
          "Climate learning can take place across universities, academies, professional programmes, events and other organizations. The records are often stored by separate institutions and may use different formats.",
          "A learning record is not always the same as a certificate. A learning record may describe a learning experience even when a formal certificate is not issued. A certificate may be one type of credential associated with a learning experience.",
          "Climate Passport is designed to connect supported climate learning records to a persistent personal profile. It does not automatically import every climate course or learning activity in the world.",
        ],
      },
      {
        id: "climate-participation-records",
        title: "How Can Climate Participation Be Digitally Recorded?",
        lead: "Climate participation can be digitally recorded by connecting an identifiable participant with an eligible event, programme or activity and creating a structured attendance or participation record.",
        paragraphs: [
          "Depending on the programme, a participation record may be supported by registration, digital check-in, QR-based check-in, organizer confirmation, attendance confirmation or another defined verification process.",
          "Registration is not automatically the same as verified participation. A person may register for an event but not attend. Attendance or participation records may therefore require additional confirmation depending on the programme.",
          "This distinction is important for event, registration, check-in and attendance workflows because it separates intent to participate from confirmed participation.",
        ],
      },
      {
        id: "climate-action-records",
        title: "What Is a Climate Action Record?",
        lead: "A climate action record is a structured digital record of an eligible climate-related activity or action associated with an individual or participating entity.",
        paragraphs: [
          "The record may describe what took place, when it occurred, the programme or organization involved, the participant or entity associated with the action, how the activity was recorded or confirmed, and supporting evidence where appropriate.",
          "A climate action record does not automatically represent a quantified carbon reduction or verified climate impact. Impact claims require appropriate methodologies, data and verification.",
          "Recording an activity is different from measuring climate impact. An activity record can document participation or action, while impact measurement requires a defined methodology and evidence base.",
        ],
      },
      {
        id: "climate-digital-identity",
        title: "What Is Climate Digital Identity?",
        lead: "Climate digital identity is an emerging way of describing how personal climate-related learning, participation, credentials and action records can be connected within a persistent digital profile.",
        paragraphs: [
          "Climate digital identity is not a government-issued identity or travel document. It is not a national identity credential or legal identity status.",
          "Instead of keeping learning records, participation records and credentials in disconnected systems, a persistent climate-focused digital profile can connect supported records over time. Useful language for this concept includes portable profile, persistent profile, records connected across supported programmes and shareable records where appropriate.",
          "Portability should be understood carefully. A profile can make supported records easier to carry and share, but it does not imply universal interoperability or global legal recognition.",
        ],
      },
      {
        id: "how-climate-passport-connects-records",
        title: "How Climate Passport Connects These Records",
        lead: "Climate Passport connects supported records by associating them with a persistent profile and Climate Passport ID through eligible platform workflows.",
        paragraphs: [
          "The model depends on supported records, supported workflows, eligible programmes and issuing organizations that provide the relevant record. Where verification is available, it should help confirm the issuer, recipient, status and meaning of the record.",
          "Climate Passport is not a government identity, a UN identity or a travel passport. It does not mean every climate credential is recognized by the platform, every employer trusts the record, every record is blockchain-backed or every activity is a verified climate impact.",
        ],
        ordered: true,
        bullets: ["A person creates a Climate Passport profile.", "The profile is associated with a unique Climate Passport ID.", "Supported learning, participation, credential or action records can be connected to the profile.", "Authorized or relevant organizations may create, confirm or issue records through supported workflows.", "The individual can build a more continuous and portable climate-era digital profile over time."],
      },
    ],
    identityLinks: { climatePassportId: "Climate Passport ID", about: "what Climate Passport is" },
    relatedTitle: "Related Concepts",
    relatedLinks: { about: "What is Climate Passport?", climatePassportId: "What is a Climate Passport ID?", climateCredentials: "Climate credentials", credentialVerification: "Credential verification", climateDigitalIdentity: "Climate digital identity" },
  },
  zh: {
    label: "Climate Passport 知识中心",
    title: "气候记录与气候凭证：实用指南",
    metadataTitle: "气候记录与气候凭证 | Climate Passport",
    description: "介绍气候凭证、验证、学习记录、参与记录、行动记录和气候数字身份的实用指南。",
    intro: "气候相关的学习、参与、凭证和行动，往往由不同组织记录并存放在不同系统中。本指南解释主要的气候记录类型、验证方式，以及这些记录如何帮助形成更可携带、更持续的数字档案。",
    contentsTitle: "目录",
    contents: [
      { href: "#climate-credentials", label: "什么是气候凭证？" },
      { href: "#credential-verification", label: "凭证如何验证" },
      { href: "#climate-learning-records", label: "气候学习记录" },
      { href: "#climate-participation-records", label: "气候参与记录" },
      { href: "#climate-action-records", label: "气候行动记录" },
      { href: "#climate-digital-identity", label: "气候数字身份" },
      { href: "#how-climate-passport-connects-records", label: "Climate Passport 如何连接记录" },
    ],
    sections: [
      { id: "climate-credentials", title: "什么是气候凭证？", lead: "气候凭证是由可识别组织签发或确认的、与气候学习、技能、参与或成就相关的记录。", paragraphs: ["可信的气候凭证应当帮助人们理解记录由谁签发、代表什么、颁发给谁、在相关场景下何时签发，以及如何检查其真实性或签发记录。", "这个概念适合描述气候相关记录，但不应被理解为全球统一的法律类别。凭证可以由大学、活动组织方、专业项目、社会组织或其他可识别机构签发，具体含义取决于场景。"], subsections: [{ title: "气候凭证可以代表什么", body: "凭证可以代表完成学习活动、参与合格活动、贡献某个项目、获得证书，或其他被认可的气候相关成果。它的含义取决于签发方和相关记录。" }, { title: "签发方、接收者和含义", body: "签发方身份、接收者身份和凭证含义是解读记录的核心。阅读者应能区分机构签发记录与个人自我声明，并理解该记录确认了什么。" }] },
      { id: "credential-verification", title: "气候凭证如何验证？", lead: "气候凭证可以通过检查签发方、接收者、凭证标识、签发记录以及签发系统提供的验证信息来验证。", paragraphs: ["有用的验证流程应帮助第三方确认该凭证作为已签发记录确实存在，而不是一张缺少依据的图片、截图或复制文件。", "证书图片不自动等同于可验证凭证记录。视觉文件可以代表有效凭证，但验证需要适当的签发方信息、签发信息或验证系统。"], subsections: [{ title: "常见验证信号", body: "验证通常依赖清晰的签发方、接收者和记录上下文。" }], bullets: ["签发方身份和签发组织背景", "适用情况下的接收者身份或档案上下文", "凭证标识、验证码或记录标识", "相关的签发记录和签发日期", "验证页面或验证系统", "支持时的状态或撤销信息"] },
      { id: "climate-learning-records", title: "什么是气候学习记录？", lead: "气候学习记录是个人气候相关学习经历的结构化记录。", paragraphs: ["它可以记录课程、工作坊、暑期学校、专业项目、学习模块或其他合格气候学习活动的参与情况。", "气候学习可能发生在大学、学院、专业项目、活动和其他组织之间，这些记录常由不同机构保存，并使用不同格式。", "学习记录并不总是等同于证书。即使没有正式证书，学习记录也可以描述学习经历；证书则可以是与学习经历相关的一类凭证。", "Climate Passport 旨在把受支持的气候学习记录连接到持续的个人档案，但不会自动导入世界上所有气候课程或学习活动。"] },
      { id: "climate-participation-records", title: "气候参与如何被数字化记录？", lead: "气候参与可以通过将可识别参与者与合格活动、项目或行动连接，并创建结构化出席或参与记录来数字化记录。", paragraphs: ["根据项目不同，参与记录可以由报名、数字签到、二维码签到、组织方确认、出席确认或其他定义好的验证流程支持。", "报名不自动等同于已验证参与。一个人可能报名但没有实际出席，因此出席或参与记录可能需要额外确认。", "这一区分对活动、报名、签到和出席工作流很重要，因为它把参与意向和已确认参与区分开来。"] },
      { id: "climate-action-records", title: "什么是气候行动记录？", lead: "气候行动记录是与个人或参与实体相关的合格气候活动或行动的结构化数字记录。", paragraphs: ["记录可以描述发生了什么、何时发生、涉及哪个项目或组织、相关参与者或实体是谁、活动如何被记录或确认，以及适用时的支持证据。", "气候行动记录并不自动代表量化的碳减排或已验证的气候影响。影响声明需要适当的方法学、数据和验证。", "记录一项活动不同于衡量气候影响。活动记录可以记录参与或行动，而影响衡量需要明确的方法和证据基础。"] },
      { id: "climate-digital-identity", title: "什么是气候数字身份？", lead: "气候数字身份是一种正在形成的表达方式，用来描述个人气候学习、参与、凭证和行动记录如何连接到持续数字档案中。", paragraphs: ["气候数字身份不是政府签发的身份，也不是旅行证件。它不是国家身份凭证或法律身份状态。", "与其把学习记录、参与记录和凭证分散在互不相连的系统中，一个持续的气候主题数字档案可以随时间连接受支持的记录。", "可携带性需要谨慎理解。档案可以让受支持记录更容易携带和分享，但并不意味着全球通用互操作或法律承认。"] },
      { id: "how-climate-passport-connects-records", title: "Climate Passport 如何连接这些记录", lead: "Climate Passport 通过合格平台工作流，把受支持记录与持续档案和 Climate Passport ID 关联起来。", paragraphs: ["这一模型依赖受支持记录、受支持工作流、合格项目以及提供相关记录的签发组织。在可验证的情况下，它应帮助确认签发方、接收者、状态和记录含义。", "Climate Passport 不是政府身份、联合国身份或旅行护照。它不表示每个气候凭证都会被平台认可、每个雇主都会信任该记录、每条记录都有区块链背书，或每项活动都是已验证的气候影响。"], ordered: true, bullets: ["个人创建 Climate Passport 档案。", "档案关联一个唯一的 Climate Passport ID。", "受支持的学习、参与、凭证或行动记录可以连接到档案。", "授权或相关组织可以通过受支持工作流创建、确认或签发记录。", "个人可以逐步建立更连续、更可携带的气候时代数字档案。"] },
    ],
    identityLinks: { climatePassportId: "Climate Passport ID", about: "Climate Passport 是什么" },
    relatedTitle: "相关概念",
    relatedLinks: { about: "Climate Passport 是什么？", climatePassportId: "什么是 Climate Passport ID？", climateCredentials: "气候凭证", credentialVerification: "凭证验证", climateDigitalIdentity: "气候数字身份" },
  },
  fr: {
    label: "Centre de connaissances Climate Passport",
    title: "Enregistrements et justificatifs climatiques : guide pratique",
    metadataTitle: "Enregistrements et justificatifs climatiques | Climate Passport",
    description: "Guide pratique des justificatifs climatiques, de la verification, des dossiers d'apprentissage, de participation, d'action et de l'identite numerique climatique.",
    intro: "Les apprentissages, participations, justificatifs et actions lies au climat sont souvent enregistres par differentes organisations dans des formats distincts. Ce guide explique les principaux types d'enregistrements climatiques, le fonctionnement de la verification et leur contribution a un profil numerique plus portable et durable.",
    contentsTitle: "Sommaire",
    contents: [
      { href: "#climate-credentials", label: "Que sont les justificatifs climatiques ?" },
      { href: "#credential-verification", label: "Comment fonctionne la verification" },
      { href: "#climate-learning-records", label: "Dossiers d'apprentissage climatique" },
      { href: "#climate-participation-records", label: "Dossiers de participation climatique" },
      { href: "#climate-action-records", label: "Dossiers d'action climatique" },
      { href: "#climate-digital-identity", label: "Identite numerique climatique" },
      { href: "#how-climate-passport-connects-records", label: "Comment Climate Passport relie les dossiers" },
    ],
    sections: [
      { id: "climate-credentials", title: "Que sont les justificatifs climatiques ?", lead: "Les justificatifs climatiques sont des enregistrements d'apprentissage, de competences, de participation ou de realisation lies au climat, emis ou confirmes par une organisation identifiable.", paragraphs: ["Un justificatif fiable doit permettre de comprendre qui l'a emis, ce qu'il represente, qui l'a recu, quand il a ete emis le cas echeant, et comment son authenticite ou son dossier d'emission peut etre verifie.", "Le terme est utile pour decrire des enregistrements lies au climat, mais il ne doit pas etre considere comme une categorie juridique universellement standardisee."], subsections: [{ title: "Ce qu'un justificatif peut representer", body: "Il peut representer la fin d'une activite d'apprentissage, la participation a un evenement eligible, une contribution a un programme, la reception d'un certificat ou un autre resultat climatique reconnu." }, { title: "Emetteur, beneficiaire et signification", body: "L'identite de l'emetteur, l'identite du beneficiaire et la signification du justificatif sont essentielles pour interpreter le dossier." }] },
      { id: "credential-verification", title: "Comment verifier les justificatifs climatiques ?", lead: "Les justificatifs climatiques peuvent etre verifies en controlant l'emetteur, le beneficiaire, l'identifiant du justificatif, le dossier d'emission et les informations de verification fournies par le systeme emetteur.", paragraphs: ["Un processus utile aide un tiers a confirmer que le justificatif existe comme dossier emis et qu'il ne s'agit pas simplement d'une image, capture d'ecran ou copie sans support.", "Une image de certificat n'est pas automatiquement un dossier de justificatif verifiable. La verification necessite des informations adaptees sur l'emetteur, l'emission ou un systeme de verification."], subsections: [{ title: "Signaux courants de verification", body: "La verification depend generalement d'un contexte clair sur l'emetteur, le beneficiaire et le dossier." }], bullets: ["Identite de l'emetteur et contexte de l'organisation", "Identite du beneficiaire ou contexte de profil si necessaire", "Identifiant du justificatif, code de verification ou identifiant de dossier", "Dossier et date d'emission le cas echeant", "Page ou systeme de verification", "Statut ou information de revocation si disponible"] },
      { id: "climate-learning-records", title: "Qu'est-ce qu'un dossier d'apprentissage climatique ?", lead: "Un dossier d'apprentissage climatique est un enregistrement structure d'une experience individuelle d'apprentissage liee au climat.", paragraphs: ["Il peut documenter la participation a un cours, atelier, programme professionnel, module d'apprentissage ou autre activite eligible.", "L'apprentissage climatique peut se derouler dans des universites, academies, programmes professionnels, evenements et autres organisations.", "Un dossier d'apprentissage n'est pas toujours un certificat. Il peut decrire une experience meme sans certificat formel.", "Climate Passport vise a relier les dossiers d'apprentissage climatiques pris en charge a un profil personnel persistant."] },
      { id: "climate-participation-records", title: "Comment enregistrer numeriquement la participation climatique ?", lead: "La participation climatique peut etre enregistree en reliant un participant identifiable a un evenement, programme ou activite eligible et en creant un dossier structure de presence ou de participation.", paragraphs: ["Selon le programme, le dossier peut s'appuyer sur l'inscription, l'enregistrement numerique, le check-in par QR code, la confirmation de l'organisateur ou un autre processus defini.", "L'inscription n'est pas automatiquement une participation verifiee. Une personne peut s'inscrire sans assister a l'evenement.", "Cette distinction separe l'intention de participer de la participation confirmee."] },
      { id: "climate-action-records", title: "Qu'est-ce qu'un dossier d'action climatique ?", lead: "Un dossier d'action climatique est un enregistrement numerique structure d'une activite ou action climatique eligible associee a une personne ou entite participante.", paragraphs: ["Le dossier peut decrire ce qui s'est produit, quand, le programme ou l'organisation impliquee, le participant associe, la maniere dont l'activite a ete confirmee et les preuves disponibles.", "Un dossier d'action climatique ne represente pas automatiquement une reduction carbone quantifiee ou un impact climatique verifie. Ces affirmations exigent des methodes, donnees et verifications adaptees.", "Enregistrer une activite est different de mesurer son impact climatique."] },
      { id: "climate-digital-identity", title: "Qu'est-ce que l'identite numerique climatique ?", lead: "L'identite numerique climatique decrit la facon dont les apprentissages, participations, justificatifs et actions climatiques d'une personne peuvent etre relies dans un profil numerique persistant.", paragraphs: ["Elle n'est pas une identite delivree par un gouvernement ni un document de voyage. Elle n'est pas un statut d'identite juridique nationale.", "Un profil numerique oriente climat peut relier au fil du temps les dossiers pris en charge, au lieu de les laisser dans des systemes separes.", "La portabilite doit etre comprise avec prudence : elle facilite le partage de dossiers pris en charge sans impliquer une reconnaissance juridique mondiale."] },
      { id: "how-climate-passport-connects-records", title: "Comment Climate Passport relie ces dossiers", lead: "Climate Passport relie les dossiers pris en charge a un profil persistant et a un Climate Passport ID via des workflows eligibles de la plateforme.", paragraphs: ["Le modele depend des dossiers, workflows, programmes eligibles et organisations emettrices qui fournissent les donnees pertinentes.", "Climate Passport n'est pas une identite gouvernementale, une identite de l'ONU ou un passeport de voyage. Il ne garantit pas que chaque justificatif sera reconnu, approuve par un employeur, inscrit sur blockchain ou lie a un impact climatique verifie."], ordered: true, bullets: ["Une personne cree un profil Climate Passport.", "Le profil est associe a un Climate Passport ID unique.", "Les dossiers pris en charge peuvent etre relies au profil.", "Des organisations autorisees peuvent creer, confirmer ou emettre des dossiers.", "La personne construit progressivement un profil climatique plus continu et portable."] },
    ],
    identityLinks: { climatePassportId: "Climate Passport ID", about: "ce qu'est Climate Passport" },
    relatedTitle: "Concepts associes",
    relatedLinks: { about: "Qu'est-ce que Climate Passport ?", climatePassportId: "Qu'est-ce qu'un Climate Passport ID ?", climateCredentials: "Justificatifs climatiques", credentialVerification: "Verification des justificatifs", climateDigitalIdentity: "Identite numerique climatique" },
  },
  de: {
    label: "Climate Passport Wissenshub",
    title: "Klimabezogene Nachweise und Datensatze: ein praktischer Leitfaden",
    metadataTitle: "Klimabezogene Nachweise und Datensatze | Climate Passport",
    description: "Ein praktischer Leitfaden zu Klimanachweisen, Verifizierung, Lernnachweisen, Teilnahmenachweisen, Aktionsdatensatzen und klimabezogener digitaler Identitat.",
    intro: "Klimabezogenes Lernen, Teilnahme, Nachweise und Aktionen werden oft von verschiedenen Organisationen in unterschiedlichen Formaten erfasst. Dieser Leitfaden erklart die wichtigsten Arten klimabezogener Datensatze, wie Verifizierung funktioniert und wie solche Datensatze zu einem portableren digitalen Profil beitragen konnen.",
    contentsTitle: "Inhalt",
    contents: [
      { href: "#climate-credentials", label: "Was sind Klimanachweise?" },
      { href: "#credential-verification", label: "Wie Verifizierung funktioniert" },
      { href: "#climate-learning-records", label: "Klimabezogene Lernnachweise" },
      { href: "#climate-participation-records", label: "Klimabezogene Teilnahmenachweise" },
      { href: "#climate-action-records", label: "Klimabezogene Aktionsdatensatze" },
      { href: "#climate-digital-identity", label: "Klimabezogene digitale Identitat" },
      { href: "#how-climate-passport-connects-records", label: "Wie Climate Passport Datensatze verbindet" },
    ],
    sections: [
      { id: "climate-credentials", title: "Was sind Klimanachweise?", lead: "Klimanachweise sind Datensatze uber klimabezogenes Lernen, Kompetenzen, Teilnahme oder Leistungen, die von einer identifizierbaren Organisation ausgestellt oder bestatigt werden.", paragraphs: ["Ein vertrauenswurdiger Nachweis sollte zeigen, wer ihn ausgestellt hat, was er bedeutet, wer ihn erhalten hat, wann er gegebenenfalls ausgestellt wurde und wie Echtheit oder Ausstellungsdatensatz gepruft werden konnen.", "Der Begriff beschreibt klimabezogene Datensatze, ist aber keine weltweit einheitliche rechtliche Kategorie."], subsections: [{ title: "Was ein Klimanachweis darstellen kann", body: "Er kann den Abschluss einer Lernaktivitat, die Teilnahme an einer geeigneten Veranstaltung, einen Beitrag zu einem Programm, ein Zertifikat oder ein anderes anerkanntes klimabezogenes Ergebnis darstellen." }, { title: "Aussteller, Empfanger und Bedeutung", body: "Ausstelleridentitat, Empfangeridentitat und Bedeutung des Nachweises sind zentral fur die Interpretation." }] },
      { id: "credential-verification", title: "Wie konnen Klimanachweise verifiziert werden?", lead: "Klimanachweise konnen durch Prufung von Aussteller, Empfanger, Nachweiskennung, Ausstellungsdatensatz und den vom System bereitgestellten Verifizierungsinformationen gepruft werden.", paragraphs: ["Ein nutzlicher Prozess hilft Dritten zu bestatigen, dass der Nachweis als ausgestellter Datensatz existiert und nicht nur ein ungestutztes Bild, ein Screenshot oder eine Kopie ist.", "Ein Zertifikatsbild ist nicht automatisch ein verifizierbarer Nachweisdatensatz. Verifizierung benotigt geeignete Informationen zum Aussteller, zur Ausstellung oder ein Verifizierungssystem."], subsections: [{ title: "Haufige Verifizierungssignale", body: "Verifizierung hangt meist von klarem Kontext zu Aussteller, Empfanger und Datensatz ab." }], bullets: ["Identitat des Ausstellers und Organisationskontext", "Empfangeridentitat oder Profilkontext, soweit relevant", "Nachweiskennung, Verifizierungscode oder Datensatzkennung", "Ausstellungsdatensatz und Ausstellungsdatum, soweit relevant", "Verifizierungsseite oder Verifizierungssystem", "Status- oder Widerrufsinformationen, soweit unterstutzt"] },
      { id: "climate-learning-records", title: "Was ist ein klimabezogener Lernnachweis?", lead: "Ein klimabezogener Lernnachweis ist ein strukturierter Datensatz uber eine individuelle klimabezogene Lernerfahrung.", paragraphs: ["Er kann die Teilnahme an Kursen, Workshops, Sommerschulen, beruflichen Programmen, Lernmodulen oder anderen geeigneten Lernaktivitaten dokumentieren.", "Klimabezogenes Lernen findet in Universitaten, Akademien, beruflichen Programmen, Veranstaltungen und anderen Organisationen statt.", "Ein Lernnachweis ist nicht immer dasselbe wie ein Zertifikat. Er kann eine Lernerfahrung beschreiben, auch wenn kein formales Zertifikat ausgestellt wird.", "Climate Passport soll unterstutzte klimabezogene Lernnachweise mit einem dauerhaften personlichen Profil verbinden."] },
      { id: "climate-participation-records", title: "Wie kann klimabezogene Teilnahme digital erfasst werden?", lead: "Klimabezogene Teilnahme kann digital erfasst werden, indem ein identifizierbarer Teilnehmer mit einer geeigneten Veranstaltung, einem Programm oder einer Aktivitat verbunden und ein strukturierter Teilnahme- oder Anwesenheitsdatensatz erstellt wird.", paragraphs: ["Je nach Programm kann der Datensatz durch Registrierung, digitalen Check-in, QR-Check-in, Bestatigung des Veranstalters oder einen anderen definierten Prozess gestutzt werden.", "Registrierung ist nicht automatisch verifizierte Teilnahme. Eine Person kann sich anmelden, ohne teilzunehmen.", "Diese Unterscheidung trennt die Absicht zur Teilnahme von bestatigter Teilnahme."] },
      { id: "climate-action-records", title: "Was ist ein klimabezogener Aktionsdatensatz?", lead: "Ein klimabezogener Aktionsdatensatz ist ein strukturierter digitaler Datensatz uber eine geeignete klimabezogene Aktivitat oder Aktion, die einer Person oder teilnehmenden Einheit zugeordnet ist.", paragraphs: ["Der Datensatz kann beschreiben, was stattgefunden hat, wann es geschah, welches Programm oder welche Organisation beteiligt war, wer zugeordnet ist, wie die Aktivitat erfasst oder bestatigt wurde und welche Nachweise vorliegen.", "Ein klimabezogener Aktionsdatensatz steht nicht automatisch fur eine quantifizierte CO2-Reduktion oder verifizierte Klimawirkung. Wirkungsaussagen erfordern geeignete Methoden, Daten und Verifizierung.", "Eine Aktivitat zu erfassen ist etwas anderes als Klimawirkung zu messen."] },
      { id: "climate-digital-identity", title: "Was ist klimabezogene digitale Identitat?", lead: "Klimabezogene digitale Identitat beschreibt, wie personliche klimabezogene Lern-, Teilnahme-, Nachweis- und Aktionsdatensatze in einem dauerhaften digitalen Profil verbunden werden konnen.", paragraphs: ["Sie ist keine staatlich ausgestellte Identitat und kein Reisedokument. Sie ist kein nationaler Identitatsnachweis und kein rechtlicher Identitatsstatus.", "Ein klimafokussiertes digitales Profil kann unterstutzte Datensatze im Zeitverlauf verbinden, statt sie in getrennten Systemen zu belassen.", "Portabilitat sollte sorgfaltig verstanden werden: Sie erleichtert das Mitnehmen und Teilen unterstutzter Datensatze, bedeutet aber keine weltweite rechtliche Anerkennung."] },
      { id: "how-climate-passport-connects-records", title: "Wie Climate Passport diese Datensatze verbindet", lead: "Climate Passport verbindet unterstutzte Datensatze uber geeignete Plattform-Workflows mit einem dauerhaften Profil und einer Climate Passport ID.", paragraphs: ["Das Modell hangt von unterstutzten Datensatzen, Workflows, geeigneten Programmen und ausstellenden Organisationen ab.", "Climate Passport ist keine staatliche Identitat, keine UN-Identitat und kein Reisepass. Es bedeutet nicht, dass jeder Klimanachweis anerkannt, von jedem Arbeitgeber akzeptiert, blockchain-basiert oder mit verifizierter Klimawirkung verbunden ist."], ordered: true, bullets: ["Eine Person erstellt ein Climate Passport Profil.", "Das Profil wird mit einer eindeutigen Climate Passport ID verbunden.", "Unterstutzte Lern-, Teilnahme-, Nachweis- oder Aktionsdatensatze konnen verbunden werden.", "Autorisierte oder relevante Organisationen konnen Datensatze erstellen, bestatigen oder ausstellen.", "Die Person baut im Zeitverlauf ein kontinuierlicheres und portableres Klimaprofil auf."] },
    ],
    identityLinks: { climatePassportId: "Climate Passport ID", about: "was Climate Passport ist" },
    relatedTitle: "Verwandte Konzepte",
    relatedLinks: { about: "Was ist Climate Passport?", climatePassportId: "Was ist eine Climate Passport ID?", climateCredentials: "Klimanachweise", credentialVerification: "Nachweisverifizierung", climateDigitalIdentity: "Klimabezogene digitale Identitat" },
  },
};

export function getClimateRecordsHubContent(locale: Locale) {
  return content[locale];
}

export function climateRecordsHubTitle(locale: Locale) {
  return content[locale].metadataTitle;
}

export function climateRecordsHubDescription(locale: Locale) {
  return content[locale].description;
}

export function ClimateRecordsCredentialsScreen({ locale }: { locale: Locale }) {
  const page = getClimateRecordsHubContent(locale);
  const relatedLinks = [
    { href: `/${locale}/about`, label: page.relatedLinks.about },
    { href: `/${locale}/climate-passport-id`, label: page.relatedLinks.climatePassportId },
    { href: "#climate-credentials", label: page.relatedLinks.climateCredentials },
    { href: "#credential-verification", label: page.relatedLinks.credentialVerification },
    { href: "#climate-digital-identity", label: page.relatedLinks.climateDigitalIdentity },
  ];

  return (
    <>
      <div className="section-header knowledge-hub-header">
        <div>
          <span className="label">{page.label}</span>
          <h1>{page.title}</h1>
        </div>
        <p>{page.intro}</p>
      </div>

      <section className="section privacy-policy-content knowledge-hub-content" aria-labelledby="knowledge-hub-contents">
        <nav className="panel knowledge-hub-nav" aria-labelledby="knowledge-hub-contents">
          <h2 id="knowledge-hub-contents">{page.contentsTitle}</h2>
          <ul>
            {page.contents.map((item) => (
              <li key={item.href}>
                <a href={item.href}>{item.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        {page.sections.map((section) => {
          const ListTag = section.ordered ? "ol" : "ul";
          return (
            <article className="panel privacy-policy-section knowledge-hub-section" id={section.id} key={section.id}>
              <h2>{section.title}</h2>
              <p className="privacy-policy-lead">{section.lead}</p>
              {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.subsections?.map((subsection) => (
                <div key={subsection.title}>
                  <h3>{subsection.title}</h3>
                  <p>{subsection.body}</p>
                </div>
              ))}
              {section.bullets?.length ? (
                <ListTag className="privacy-policy-list">
                  {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ListTag>
              ) : null}
              {section.id === "climate-credentials" ? (
                <p>
                  Climate Passport uses a <Link href={`/${locale}/climate-passport-id`}>{page.identityLinks.climatePassportId}</Link> as a profile anchor for supported records. For broader context, see <Link href={`/${locale}/about`}>{page.identityLinks.about}</Link>.
                </p>
              ) : null}
              {section.id === "climate-digital-identity" ? (
                <p>
                  <Link href={`/${locale}/about`}>Climate Passport</Link> uses climate digital identity language to describe a portable digital profile for supported climate records. A <Link href={`/${locale}/climate-passport-id`}>Climate Passport ID</Link> provides the profile anchor for supported workflows.
                </p>
              ) : null}
              {section.id === "how-climate-passport-connects-records" ? (
                <p>
                  <Link href={`/${locale}/about`}>{page.relatedLinks.about}</Link> · <Link href={`/${locale}/climate-passport-id`}>{page.relatedLinks.climatePassportId}</Link>
                </p>
              ) : null}
            </article>
          );
        })}

        <section className="panel privacy-policy-section knowledge-hub-section" aria-labelledby="related-concepts">
          <h2 id="related-concepts">{page.relatedTitle}</h2>
          <ul className="privacy-policy-list">
            {relatedLinks.map((link) => (
              <li key={link.href}><Link href={link.href}>{link.label}</Link></li>
            ))}
          </ul>
        </section>
      </section>
    </>
  );
}