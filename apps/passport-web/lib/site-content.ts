export const locales = ["en", "zh", "fr", "de"] as const;

export type Locale = (typeof locales)[number];

/** Core locales used by account snapshots and legacy zh/en branches */
type CoreLocale = "en" | "zh";
const coreLocaleSet = new Set<string>(["en", "zh"]);

export function isSupportedLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

type ModuleCard = {
  title: string;
  summary: string;
  href: string;
  status: string;
};

type Metric = {
  label: string;
  value: string;
  detail: string;
};

type Achievement = {
  title: string;
  detail: string;
  unlocked: boolean;
};

type CertificateCategory = {
  name: string;
  rule: string;
  templates: number;
  status: string;
};

type CertificateQueueItem = {
  recipient: string;
  definition: string;
  status: string;
  linkedOutcome: string;
};

type VerificationCheck = {
  code: string;
  result: string;
  detail: string;
};

type EventCard = {
  title: string;
  window: string;
  venue: string;
  status: string;
};

type VerifierTimeline = {
  time: string;
  title: string;
  detail: string;
};

type AgendaPreview = {
  time: string;
  title: string;
  detail: string;
  speakers: string;
};

type SpeakerCard = {
  name: string;
  role: string;
  organization: string;
  region: string;
  tags: string[];
  status: string;
};

type NotificationChannel = {
  title: string;
  description: string;
  status: string;
};

type NotificationItem = {
  title: string;
  detail: string;
  status: string;
};

type MessageThread = {
  subject: string;
  counterpart: string;
  status: string;
  detail: string;
};

type InfoSection = {
  title: string;
  body: string;
};

type InfoPage = {
  label: string;
  title: string;
  intro: string;
  sections: InfoSection[];
};

type SiteDictionary = {
  shell: {
    nav: Array<{ href: string; label: string }>;
    switchLabel: string;
    actions: {
      summerSchool: string;
      admin: string;
      dashboard: string;
      logout: string;
      login: string;
      register: string;
    };
    footer: {
      platformTitle: string;
      platformText: string;
      sitemapTitle: string;
      infoTitle: string;
      infoLinks: Array<{ href: string; label: string }>;
      shellTitle: string;
      shellText: string;
      certificateTitle: string;
      certificateText: string;
      rights: string;
    };
  };
  home: {
    kicker: string;
    title: string;
    subtitle: string;
    body: string;
    primaryCta: string;
    secondaryCta: string;
    proofTitle: string;
    proofBody: string;
    readyAuth: string;
    readyPassport: string;
    readyCertificates: string;
    note: string;
    sectionLabel: string;
    sectionTitle: string;
    sectionBody: string;
    modules: ModuleCard[];
    metrics: Metric[];
  };
  passport: {
    label: string;
    title: string;
    intro: string;
    authority: string;
    authorityBody: string;
    activeBadge: string;
    points: string;
    attended: string;
    hours: string;
    issued: string;
    achievements: string;
    qrLabel: string;
    qrTitle: string;
    qrNote: string;
    archiveLabel: string;
    archiveTitle: string;
    achievementsList: Achievement[];
  };
  certificates: {
    label: string;
    title: string;
    intro: string;
    familyLabel: string;
    familyTitle: string;
    generationLabel: string;
    generationTitle: string;
    verificationLabel: string;
    verificationTitle: string;
    verificationNote: string;
    reviewAction: string;
    categories: CertificateCategory[];
    queue: CertificateQueueItem[];
    checks: VerificationCheck[];
  };
  events: {
    label: string;
    title: string;
    intro: string;
    agendaLabel: string;
    agendaTitle: string;
    verifierLabel: string;
    verifierTitle: string;
    ruleLabel: string;
    ruleTitle: string;
    ruleBody: string;
    cards: EventCard[];
    agenda: AgendaPreview[];
    timeline: VerifierTimeline[];
  };
  speakers: {
    label: string;
    title: string;
    intro: string;
    featuredLabel: string;
    featuredTitle: string;
    roleLabel: string;
    roleTitle: string;
    cards: SpeakerCard[];
  };
  notifications: {
    label: string;
    title: string;
    intro: string;
    channelsLabel: string;
    channelsTitle: string;
    feedLabel: string;
    feedTitle: string;
    channels: NotificationChannel[];
    items: NotificationItem[];
  };
  messages: {
    label: string;
    title: string;
    intro: string;
    inboxLabel: string;
    inboxTitle: string;
    policyLabel: string;
    policyTitle: string;
    threads: MessageThread[];
  };
  info: {
    about: InfoPage;
    contact: InfoPage;
    terms: InfoPage;
    privacy: InfoPage;
    faq: InfoPage;
  };
  auth: {
    login: {
      kicker: string;
      title: string;
      body: string;
      formLabel: string;
      formTitle: string;
      email: string;
      password: string;
      submit: string;
      switchCta: string;
      note: string;
    };
    register: {
      formLabel: string;
      formTitle: string;
      name: string;
      email: string;
      password: string;
      submit: string;
      switchCta: string;
      kicker: string;
      title: string;
      body: string;
    };
  };
};

export const accountSnapshotByLocale: Record<CoreLocale, {
  name: string;
  role: string;
  climatePassportId: string;
  points: number;
  attended: number;
  learningHours: number;
  achievements: number;
  issuedAt: string;
}> = {
  en: {
    name: "Lin Qiao",
    role: "Contributor",
    climatePassportId: "CP-2026-012480",
    points: 184,
    attended: 16,
    learningHours: 42,
    achievements: 9,
    issuedAt: "2026-05-20",
  },
  zh: {
    name: "林乔",
    role: "Contributor",
    climatePassportId: "CP-2026-012480",
    points: 184,
    attended: 16,
    learningHours: 42,
    achievements: 9,
    issuedAt: "2026-05-20",
  },
};

export const siteContent: Record<CoreLocale, SiteDictionary> = {
  en: {
    shell: {
      nav: [],
      switchLabel: "Language",
      actions: {
        summerSchool: "Summer School",
        admin: "Admin",
        dashboard: "Dashboard",
        logout: "Logout",
        login: "Login",
        register: "Register",
      },
      footer: {
        platformTitle: "Climate Passport",
        platformText:
          "The trusted platform for verified identity, credentials, learning records, and climate action. Your verified profile, wherever you go.",
        sitemapTitle: "Platform",
        infoTitle: "Information",
        infoLinks: [
          { href: "/about", label: "About" },
          { href: "/contact", label: "Contact" },
          { href: "/terms", label: "Terms" },
          { href: "/privacy", label: "Privacy" },
          { href: "/faq", label: "FAQ" },
        ],
        shellTitle: "Get started",
        shellText:
          "Register for a free Climate Passport account. Record your climate learning, earn credentials, and build a verified profile that opens doors.",
        certificateTitle: "Certificates",
        certificateText:
          "Browse certificate categories, earn credentials through events and learning, and verify any Climate Passport certificate through the public verification portal.",
        rights: "\u00a9 2026 Climate Passport. Trusted identity infrastructure for the climate era.",
      },
    },
    home: {
      kicker: "Climate Identity Infrastructure",
      title: "Building trusted digital identity infrastructure for the climate era.",
      subtitle: "For the planet, for yourself, for the future",
      body:
        "Climate Passport records your credentials, events, learning, and climate action into a trusted digital profile you own and can share anywhere.",
      primaryCta: "Create my Passport",
      secondaryCta: "Explore certificates",
      proofTitle: "Why Climate Passport",
      proofBody: "Build a verified profile that opens doors.",
      readyAuth: "Register your identity — create a secure, unique Climate Passport account.",
      readyPassport: "Participate and build records — attend events, complete learning, earn records that count.",
      readyCertificates: "Earn credentials and share — receive verified certificates and share your Passport anywhere.",
      note:
        "Join 12,480+ climate professionals building their verified records on Climate Passport.",
      sectionLabel: "Platform features",
      sectionTitle: "Everything you need in one place",
      sectionBody:
        "Manage your verified identity, credentials, events, and learning records from a single trusted platform.",
      modules: [
        {
          title: "Identity & Passport",
          summary:
            "Your verified identity and credential wallet. Manage your profile, view your climate action archive, and share your QR identity.",
          href: "/dashboard/climate-passport",
          status: "Your Passport",
        },
        {
          title: "Certificates & Credentials",
          summary:
            "Browse available certificate categories, view your issued credentials, and verify authenticity through the public verification portal.",
          href: "/certificates",
          status: "Your credentials",
        },
        {
          title: "Events & Participation",
          summary:
            "Discover conferences, workshops, and climate programmes. Register, attend, and earn verified participation records.",
          href: "/events",
          status: "Discover events",
        },
      ],
      metrics: [
        { label: "Passport holders", value: "12,480", detail: "verified identities" },
        { label: "Active events", value: "84", detail: "open for registration" },
        { label: "Certificates issued", value: "2,316", detail: "verified credentials" },
        { label: "Attendance records", value: "18,940", detail: "verified participations" },
      ],
    },
    passport: {
      label: "My Passport",
      title: "My Climate Passport",
      intro:
        "Your verified identity, credentials, participation record, and achievements — all in one secure workspace.",
      authority: "Issued by Climate Passport",
      authorityBody:
        "A trusted record of your climate learning, participation, and credentials.",
      activeBadge: "Active",
      points: "Points",
      attended: "Events attended",
      hours: "Learning hours",
      issued: "Issued",
      achievements: "achievements earned",
      qrLabel: "Passport QR",
      qrTitle: "Scan to verify identity",
      qrNote:
        "Share this QR code with event organisers, institutions, or programmes to verify your Climate Passport identity.",
      archiveLabel: "Achievements",
      archiveTitle: "Your achievement record",
      achievementsList: [
        { title: "Verified Participant", detail: "Completed attendance verification at 5 or more events.", unlocked: true },
        { title: "Milestone Archivist", detail: "Archived learning and event outcomes to your Climate Passport.", unlocked: true },
        { title: "Certificate Chain", detail: "Three independently verifiable certificates under one Passport.", unlocked: false },
        { title: "Global Explorer", detail: "Participated in events spanning multiple tracks and regions.", unlocked: true },
        { title: "Learning Leader", detail: "Completed 40+ hours of recognised learning programmes.", unlocked: true },
        { title: "First Certificate", detail: "Received your first verified certificate.", unlocked: true },
        { title: "Ambassador", detail: "Contributed as a speaker, mentor, or programme contributor.", unlocked: false },
        { title: "Climate Builder", detail: "Organised or co-designed a climate action project.", unlocked: false },
      ],
    },
    certificates: {
      label: "Certificates",
      title: "Credentials & Certificates",
      intro:
        "Browse available certificate categories, view your issued credentials, and verify certificate authenticity.",
      familyLabel: "Certificate categories",
      familyTitle: "Available credential types",
      generationLabel: "Recent credentials",
      generationTitle: "Your certificates",
      verificationLabel: "Verify a certificate",
      verificationTitle: "Certificate verification",
      verificationNote:
        "Every certificate issued on Climate Passport can be independently verified. Enter a certificate code or scan the QR to confirm authenticity.",
      reviewAction: "View",
      categories: [
        { name: "Attendance Certificates", rule: "Issued after verified attendance at a Climate Passport event.", templates: 4, status: "Available" },
        { name: "Learning Milestones", rule: "Issued on completion of a recognised learning programme.", templates: 3, status: "Available" },
        { name: "Achievement Credentials", rule: "Issued when points and achievement thresholds are met.", templates: 2, status: "Coming soon" },
      ],
      queue: [
        { recipient: "Lin Qiao", definition: "Climate Innovation Sprint — Completion Certificate", status: "Issued", linkedOutcome: "CP-CERT-2026-00421" },
        { recipient: "Maya Chen", definition: "Verified Attendance — Climate Systems Forum 2026", status: "Issued", linkedOutcome: "CP-CERT-2026-00384" },
        { recipient: "Diego Sun", definition: "Systems Leadership Workshop Certificate", status: "Pending review", linkedOutcome: "CP-CERT-2026-00395" },
      ],
      checks: [
        { code: "CP-CERT-2026-00421", result: "Valid", detail: "Issued 2026-05-15. Climate Innovation Sprint completion. Holder: Lin Qiao." },
        { code: "CP-CERT-2026-00384", result: "Valid", detail: "Issued 2026-05-06. Verified attendance — Climate Systems Forum 2026." },
      ],
    },
    events: {
      label: "Events",
      title: "Discover events & opportunities",
      intro:
        "Find conferences, workshops, study tours, and climate programmes. Register, attend, and earn verified participation records that link to your Passport.",
      agendaLabel: "Programme schedule",
      agendaTitle: "Agenda highlights",
      verifierLabel: "Verifier timeline",
      verifierTitle: "Attendance and follow-up chain",
      ruleLabel: "Operation rule",
      ruleTitle: "Preserve mature flow behavior",
      ruleBody:
        "Event registration, schedule, QR, and verifier flows are managed under one platform rule set for operational consistency.",
      cards: [
        { title: "Climate Systems Forum 2026", window: "8–10 June 2026", venue: "Shanghai Expo Hall A", status: "Open for registration" },
        { title: "Urban Decarbonization Roundtable", window: "11 June 2026", venue: "Bund Sustainability House, Shanghai", status: "Invitation required" },
        { title: "Climate Finance Intensive", window: "13 June 2026", venue: "Green Finance Center, Shanghai", status: "Coming soon" },
      ],
      agenda: [
        { time: "09:00 — Jun 8", title: "Opening keynote: Climate systems framing", detail: "Climate systems framing across policy, industry, and urban implementation pathways for 2030.", speakers: "Dr. Maya Chen" },
        { time: "10:30 — Jun 8", title: "Finance and transition pathways", detail: "Cross-market discussion on capital allocation for decarbonisation and just transition.", speakers: "Diego Sun, Lin Qiao" },
        { time: "14:00 — Jun 8", title: "Urban climate action workshop", detail: "Collaborative session on city-level decarbonisation plans and citizen engagement.", speakers: "Dr. Priya Nair, Carlos Mendez" },
      ],
      timeline: [
        { time: "09:12", title: "Passport QR identity verified", detail: "Matched Passport ID and profile against active entry rules." },
        { time: "09:14", title: "Attendance scan completed", detail: "Registration status moved to attended and points ledger queued." },
        { time: "09:16", title: "Certificate eligibility triggered", detail: "Attendance certificate definition matched for post-event issuance." },
      ],
    },
    speakers: {
      label: "People",
      title: "Speakers & Contributors",
      intro:
        "Meet the speakers, programme leaders, and contributors shaping climate action at our events.",
      featuredLabel: "Featured speakers",
      featuredTitle: "Confirmed speakers",
      roleLabel: "Data governance",
      roleTitle: "People data belongs to the platform",
      cards: [
        {
          name: "Dr. Maya Chen",
          role: "Director, Climate Systems Innovation",
          organization: "Global Climate Institute",
          region: "Shanghai / Global",
          tags: ["Policy", "Systems", "Transition"],
          status: "Keynote",
        },
        {
          name: "Lin Qiao",
          role: "Programme Lead, Youth Action",
          organization: "Climate Passport",
          region: "Shanghai",
          tags: ["Youth", "Participation", "Leadership"],
          status: "Moderator",
        },
        {
          name: "Diego Sun",
          role: "Head of Climate Finance",
          organization: "Greenfield Capital",
          region: "Singapore",
          tags: ["Finance", "ESG", "Transition"],
          status: "Speaker",
        },
        {
          name: "Dr. Priya Nair",
          role: "Urban Climate Resilience Lead",
          organization: "C40 Cities",
          region: "Mumbai / Global",
          tags: ["Urban", "Resilience", "Infrastructure"],
          status: "Speaker",
        },
        {
          name: "Carlos Mendez",
          role: "Director, Sustainable Supply Chains",
          organization: "Supply Chain Council",
          region: "Mexico City",
          tags: ["Supply Chain", "Circular Economy"],
          status: "Panellist",
        },
        {
          name: "Aisha Okonkwo",
          role: "Climate Justice & Advocacy Lead",
          organization: "African Climate Foundation",
          region: "Lagos / Nairobi",
          tags: ["Justice", "Advocacy", "Africa"],
          status: "Panellist",
        },
      ],
    },
    notifications: {
      label: "Notifications",
      title: "Notification preferences and activity feed",
      intro:
        "Climate Passport uses its own notification layer because approval results, attendance verification, certificates, and access updates are core platform events.",
      channelsLabel: "Delivery channels",
      channelsTitle: "Preferences",
      feedLabel: "Recent activity",
      feedTitle: "Platform-triggered notices",
      channels: [
        { title: "Email notifications", description: "Certificate issuance, approval results, and access changes are delivered by email.", status: "Enabled" },
        { title: "In-product notices", description: "Activity updates are also visible inside the Passport dashboard.", status: "Enabled" },
        { title: "SMS alerts", description: "Reserved for urgent access and check-in related changes.", status: "Optional" },
      ],
      items: [
        { title: "Attendance verified", detail: "Your event attendance was confirmed and archived to Climate Passport.", status: "New" },
        { title: "Certificate ready", detail: "A certificate has been issued and is available for verification and download.", status: "Issued" },
      ],
    },
    messages: {
      label: "Messages",
      title: "User support and workflow messages",
      intro:
        "Messages in Climate Passport cover workflow-specific communication such as invitation processing, access approvals, and operational replies.",
      inboxLabel: "Inbox",
      inboxTitle: "Workflow-linked messages",
      policyLabel: "Boundary note",
      policyTitle: "Platform messages are transactional",
      threads: [
        { subject: "Invitation request review", counterpart: "Passport operations", status: "Pending", detail: "Invitation-related replies should stay attached to the request lifecycle." },
        { subject: "Special pass status", counterpart: "Access team", status: "Approved", detail: "Access decisions should surface in Passport messages and notifications together." },
      ],
    },
    info: {
      about: {
        label: "About Climate Passport",
        title: "About the independent Climate Passport platform",
        intro: "Climate Passport is the system of record for identity, participation, achievements, certificates, and long-term climate growth profiles across partner channels.",
        sections: [
          { title: "What it is", body: "Climate Passport is not a campaign microsite. It is the shared platform layer that owns accounts, event participation, certificate issuance, and user growth records." },
          { title: "How channel integration works", body: "Partner channels can present Climate Passport-powered flows, while user and participation data remains owned by the Passport platform." },
        ],
      },
      contact: {
        label: "Contact",
        title: "Contact Climate Passport operations",
        intro: "Passport contact content is platform-specific and focused on account and workflow operations.",
        sections: [
          { title: "Operations", body: "For account, access, invitation, certificate, or verification issues, contact Passport operations at support@climatepass.org." },
          { title: "Partnership API access", body: "For platform integrations and channel access, contact platform@climatepass.org." },
        ],
      },
      terms: {
        label: "Terms",
        title: "Climate Passport terms of use",
        intro: "These terms govern use of the platform identity, event participation, and certificate records managed by Climate Passport.",
        sections: [
          { title: "Platform scope", body: "Using Climate Passport means your registration, event participation, and certificate activities may be processed across multiple climate-related partner channels that rely on the platform." },
          { title: "Record integrity", body: "Users must not manipulate attendance, certificate verification, or access workflows. Verified records are part of the platform archive." },
        ],
      },
      privacy: {
        label: "Privacy",
        title: "Climate Passport privacy",
        intro: "Privacy content for Climate Passport reflects platform-level identity and participation processing.",
        sections: [
          { title: "Data collected", body: "Climate Passport processes account details, participation records, verification events, certificate archives, and workflow submissions needed to operate the platform." },
          { title: "Channel reuse", body: "Branded channel sites may present Passport flows, but shared data is governed by the platform privacy policy rather than only by the channel shell." },
        ],
      },
      faq: {
        label: "FAQ",
        title: "Climate Passport help center",
        intro: "Passport FAQ content answers platform questions such as identity, records, certificates, and approvals.",
        sections: [
          { title: "Why do I log in through Climate Passport?", body: "Because account ownership, event participation, certificates, and approvals are managed by the shared Passport platform." },
          { title: "Can multiple channels use the same account?", body: "Yes. Climate Passport provides one identity and one record archive across connected channels." },
        ],
      },
    },
    auth: {
      login: {
        kicker: "Welcome back",
        title: "Sign in to Climate Passport",
        body:
          "Access your verified identity, credentials, participation records, and achievements.",
        formLabel: "Sign in",
        formTitle: "Enter your details",
        email: "Email address",
        password: "Password",
        submit: "Sign in",
        switchCta: "Create an account",
        note: "New to Climate Passport? Create your account to start building your verified climate record.",
      },
      register: {
        formLabel: "Create account",
        formTitle: "Your details",
        name: "Full name",
        email: "Email address",
        password: "Password",
        submit: "Create my Passport",
        switchCta: "Sign in instead",
        kicker: "Join Climate Passport",
        title: "Build your verified climate record.",
        body:
          "Create your account and start earning verified credentials, attendance records, and learning milestones that belong to you.",
      },
    },
  },
  zh: {
    shell: {
      nav: [],
      switchLabel: "语言切换",
      actions: {
        summerSchool: "夏校申请",
        admin: "后台",
        dashboard: "工作台",
        logout: "退出",
        login: "登录",
        register: "注册",
      },
      footer: {
        platformTitle: "Climate Passport",
        platformText: "可信气候身份与凭证平台，记录你的学习、参与、证书和气候行动。你的可验证档案，随时可用。",
        sitemapTitle: "平台",
        infoTitle: "平台信息",
        infoLinks: [
          { href: "/about", label: "关于" },
          { href: "/contact", label: "联系" },
          { href: "/terms", label: "条款" },
          { href: "/privacy", label: "隐私" },
          { href: "/faq", label: "常见问题" },
        ],
        shellTitle: "立即开始",
        shellText:
          "免费创建 Climate Passport 账号。记录你的气候学习、获取可验证凭证，构建一份打开机遇大门的可验证档案。",
        certificateTitle: "证书",
        certificateText:
          "浏览证书类别，通过活动和学习获取凭证，并通过公开验证页核验任意 Climate Passport 证书的真实性。",
        rights: "© 2026 Climate Passport，气候时代的可信身份基础设施。",
      },
    },
    home: {
      kicker: "气候身份基础设施",
      title: "属于你的气候时代可信档案",
      subtitle: "为地球，为自己，为未来",
      body: "Climate Passport 将你的凭证、活动参与、学习记录和气候行动，汇聚成一份你拥有、可随时分享的可信数字档案。",
      primaryCta: "创建我的护照",
      secondaryCta: "查看证书",
      proofTitle: "选择 Climate Passport",
      proofBody: "构建一份打开机遇大门的可验证档案",
      readyAuth: "注册身份 — 创建安全、唯一的 Climate Passport 账号。",
      readyPassport: "参与并积累记录 — 参加活动、完成学习，赢得有价值的参与证明。",
      readyCertificates: "获取凭证并对外展示 — 获取可验证的证书，并分享你的 Passport。",
      note:
        "加入全球 12,480+ 气候专业人士，在 Climate Passport 上构建你的可验证气候档案。",
      sectionLabel: "平台功能",
      sectionTitle: "一个平台，全部所需",
      sectionBody:
        "在统一可信平台上管理你的可信身份、凭证、活动和学习记录。",
      modules: [
        {
          title: "身份与护照",
          summary:
            "你的可信身份与凭证钱包。管理你的资料、查看气候行动档案，并分享你的二维码身份。",
          href: "/dashboard/climate-passport",
          status: "我的护照",
        },
        {
          title: "证书与凭证",
          summary:
            "浏览可用的证书类别，查看你已获取的凭证，通过公开验证页核验真实性。",
          href: "/certificates",
          status: "我的凭证",
        },
        {
          title: "活动与参与",
          summary:
            "发现会议、工作坊和气候项目。报名参加，获取可验证的参与记录。",
          href: "/events",
          status: "发现活动",
        },
      ],
      metrics: [
        { label: "Passport 持有者", value: "12,480", detail: "可验证身份" },
        { label: "活跃活动", value: "84", detail: "开放报名" },
        { label: "已发证书", value: "2,316", detail: "可验证凭证" },
        { label: "出席记录", value: "18,940", detail: "已验证参与" },
      ],
    },
    passport: {
      label: "我的护照",
      title: "我的 Climate Passport",
      intro:
        "你的可验证身份、凭证、参与记录和成就 — 全部集中于此。",
      authority: "由 Climate Passport 签发",
      authorityBody:
        "你的气候学习、参与与凭证的可信档案。",
      activeBadge: "已激活",
      points: "积分",
      attended: "已参与活动",
      hours: "学习小时",
      issued: "签发日期",
      achievements: "项成就已获得",
      qrLabel: "Passport 二维码",
      qrTitle: "扫码验证身份",
      qrNote:
        "将此二维码分享给活动主办方、机构或项目，以验证你的 Climate Passport 身份。",
      archiveLabel: "成就",
      archiveTitle: "你的成就记录",
      achievementsList: [
        { title: "已验证参与者", detail: "已完成 5 场或以上活动的现场核验与出席记录。", unlocked: true },
        { title: "Milestone 归档者", detail: "学习和活动成果已归入 Climate Passport 档案。", unlocked: true },
        { title: "证书链路", detail: "同一 Passport 下已有三张可独立验证的证书。", unlocked: false },
        { title: "全球探索者", detail: "参加了跨多个赛道和地区的活动。", unlocked: true },
        { title: "学习领军者", detail: "完成了 40 小时以上被认可的学习项目。", unlocked: true },
        { title: "第一张证书", detail: "获取了你的第一张可验证证书。", unlocked: true },
        { title: "大使", detail: "以演讲嘉宾、导师或项目贡献者身份参与。", unlocked: false },
        { title: "气候建设者", detail: "组织或共同设计了一个气候行动项目。", unlocked: false },
      ],
    },
    certificates: {
      label: "证书",
      title: "凭证与证书",
      intro:
        "浏览可用证书类别，查看你已获取的凭证，并验证证书真实性。",
      familyLabel: "证书类别",
      familyTitle: "可申请的凭证类型",
      generationLabel: "最新凭证",
      generationTitle: "我的证书",
      verificationLabel: "验证证书",
      verificationTitle: "证书验证",
      verificationNote:
        "Climate Passport 上签发的每张证书均可独立验证。输入证书编号或扫描二维码以确认真实性。",
      reviewAction: "查看",
      categories: [
        { name: "出席证书", rule: "在 Climate Passport 活动中完成验证出席后签发。", templates: 4, status: "可申请" },
        { name: "学习里程碑证书", rule: "完成被认可学习项目后签发。", templates: 3, status: "可申请" },
        { name: "成就凭证", rule: "达到积分和成就阈值后自动签发。", templates: 2, status: "即将推出" },
      ],
      queue: [
        { recipient: "林乔", definition: "气候创新 Sprint — 完成证书", status: "已签发", linkedOutcome: "CP-CERT-2026-00421" },
        { recipient: "陈美雅", definition: "已验证出席 — Climate Systems Forum 2026", status: "已签发", linkedOutcome: "CP-CERT-2026-00384" },
        { recipient: "孙 Diego", definition: "系统领导力工作坊证书", status: "待审核", linkedOutcome: "CP-CERT-2026-00395" },
      ],
      checks: [
        { code: "CP-CERT-2026-00421", result: "有效", detail: "2026-05-15 签发。气候创新 Sprint 完成证书。持证人：林乔。" },
        { code: "CP-CERT-2026-00384", result: "有效", detail: "2026-05-06 签发。已验证出席 — Climate Systems Forum 2026。" },
      ],
    },
    events: {
      label: "活动",
      title: "发现活动与机会",
      intro:
        "查找会议、工作坊、研学和气候项目。报名、参加，获取与你的 Passport 直接关联的可验证参与记录。",
      agendaLabel: "项目日程",
      agendaTitle: "议程亮点",
      verifierLabel: "Verifier 时间线",
      verifierTitle: "出席与后续联动链条",
      ruleLabel: "运行规则",
      ruleTitle: "保留成熟流程行为",
      ruleBody: "活动报名、我的日程、二维码和 verifier 流程由统一平台规则管理，保障跨页面和跨渠道的一致性。",
      cards: [
        { title: "Climate Systems Forum 2026", window: "2026年6月8—10日", venue: "上海世博馆 A 厅", status: "报名开放中" },
        { title: "城市脱碳圆桌会议", window: "2026年6月11日", venue: "外滩可持续之家，上海", status: "需邀请函" },
        { title: "气候金融密集课", window: "2026年6月13日", venue: "绿色金融中心，上海", status: "即将开放" },
      ],
      agenda: [
        { time: "9:00 — 6月8日", title: "开幕主旨：气候系统转型框架", detail: "围绕政策、产业与城市落地的气候系统性转型路径。", speakers: "Dr. Maya Chen" },
        { time: "10:30 — 6月8日", title: "金融与转型路径", detail: "聚焦脱碳资本配置与公正转型的跨市场协作讨论。", speakers: "Diego Sun、林乔" },
        { time: "14:00 — 6月8日", title: "城市气候行动工作坊", detail: "城市级脱碳方案与市民参与的协作式研讨。", speakers: "Dr. Priya Nair、Carlos Mendez" },
      ],
      timeline: [
        { time: "09:12", title: "Passport 二维码身份核验", detail: "根据 Passport ID 与激活规则完成身份匹配。" },
        { time: "09:14", title: "出席扫码完成", detail: "报名状态更新为 attended，并触发积分流水。" },
        { time: "09:16", title: "证书资格触发", detail: "匹配到活动后续的出席证书发放定义。" },
      ],
    },
    speakers: {
      label: "人物",
      title: "嘉宾与贡献者",
      intro:
        "认识引领气候行动的嘉宾、项目领导者与贡献者。",
      featuredLabel: "重点嘉宾",
      featuredTitle: "确认莅席嘉宾",
      roleLabel: "数据治理",
      roleTitle: "People 主数据属于平台",
      cards: [
        {
          name: "Dr. Maya Chen",
          role: "气候系统创新总监",
          organization: "Global Climate Institute",
          region: "上海 / 全球",
          tags: ["政策", "系统", "转型"],
          status: "主旨嘉宾",
        },
        {
          name: "林乔",
          role: "青年行动项目负责人",
          organization: "Climate Passport",
          region: "上海",
          tags: ["青年", "参与", "领导力"],
          status: "主持人",
        },
        {
          name: "Diego Sun",
          role: "气候金融项目总监",
          organization: "Greenfield Capital",
          region: "新加坡",
          tags: ["金融", "ESG", "转型"],
          status: "嘉宾",
        },
        {
          name: "Dr. Priya Nair",
          role: "城市气候韧性项目负责人",
          organization: "C40 Cities",
          region: "孟买 / 全球",
          tags: ["城市", "韧性", "基础设施"],
          status: "嘉宾",
        },
        {
          name: "Carlos Mendez",
          role: "可持续供应链项目总监",
          organization: "Supply Chain Council",
          region: "墨西哥城",
          tags: ["供应链", "循环经济"],
          status: "圆桌嘉宾",
        },
        {
          name: "Aisha Okonkwo",
          role: "气候公正与倡导改变项目负责人",
          organization: "African Climate Foundation",
          region: "拉各斯 / 内罗毕",
          tags: ["公正", "倡导", "非洲"],
          status: "圆桌嘉宾",
        },
      ],
    },
    notifications: {
      label: "通知",
      title: "通知偏好与活动流",
      intro: "Climate Passport 需要自己的通知层，因为审批结果、签到核验、证书签发和准入状态变化都属于平台事件。",
      channelsLabel: "送达通道",
      channelsTitle: "偏好设置",
      feedLabel: "最近活动",
      feedTitle: "平台触发的通知",
      channels: [
        { title: "邮件通知", description: "证书签发、审批结果和准入状态变化通过邮件发送。", status: "已开启" },
        { title: "站内通知", description: "关键活动更新也会显示在 Passport 仪表板内。", status: "已开启" },
        { title: "短信提醒", description: "保留给重要的准入或现场核验变更。", status: "可选" },
      ],
      items: [
        { title: "出席已核验", detail: "你的活动出席已确认，并已归档到 Climate Passport。", status: "新通知" },
        { title: "证书已就绪", detail: "新的证书已签发，可进行验真和下载。", status: "已签发" },
      ],
    },
    messages: {
      label: "消息",
      title: "用户支持与流程消息",
      intro: "Climate Passport 的消息覆盖邀请函处理、准入审批、运营回复等流程型沟通。",
      inboxLabel: "收件箱",
      inboxTitle: "与流程绑定的消息",
      policyLabel: "边界说明",
      policyTitle: "平台消息以事务性为主",
      threads: [
        { subject: "邀请函申请审核", counterpart: "Passport 运营", status: "处理中", detail: "邀请函相关回复应与申请生命周期绑定展示。" },
        { subject: "特别通行证状态", counterpart: "准入团队", status: "已批准", detail: "准入结果应同时出现在 Passport 消息与通知中。" },
      ],
    },
    info: {
      about: {
        label: "关于 Climate Passport",
        title: "关于独立的 Climate Passport 平台",
        intro: "Climate Passport 是合作渠道共同使用的身份、参与、成就、证书与长期气候成长档案系统。",
        sections: [
          { title: "它是什么", body: "Climate Passport 不是宣传站点，而是统一承载账号、活动参与、证书签发和用户成长档案的共享平台层。" },
          { title: "渠道集成方式", body: "合作渠道可承载 Passport 流程，但用户与参与主数据归属于 Passport 平台。" },
        ],
      },
      contact: {
        label: "联系",
        title: "联系 Climate Passport 运营团队",
        intro: "Passport 的联系内容面向平台账号与流程问题处理。",
        sections: [
          { title: "运营支持", body: "关于账号、准入、邀请函、证书或核验问题，请联系 support@climatepass.org。" },
          { title: "平台接入", body: "关于平台集成与渠道接入，请联系 platform@climatepass.org。" },
        ],
      },
      terms: {
        label: "使用条款",
        title: "Climate Passport 使用条款",
        intro: "这些条款适用于 Climate Passport 管理的账号身份、活动参与和证书记录。",
        sections: [
          { title: "平台范围", body: "使用 Climate Passport 意味着你的注册、参与和证书活动可能会在多个依赖该平台的气候渠道中被处理。" },
          { title: "记录完整性", body: "用户不得操纵签到、证书验真或准入流程。已核验记录属于平台正式档案。" },
        ],
      },
      privacy: {
        label: "隐私",
        title: "Climate Passport 隐私",
        intro: "Climate Passport 的隐私内容反映平台级身份与参与处理。",
        sections: [
          { title: "采集的数据", body: "Climate Passport 会处理账号资料、参与记录、核验事件、证书档案和流程申请数据，以支持平台运行。" },
          { title: "渠道复用", body: "各品牌渠道可以承载 Passport 流程，但共享数据受平台隐私政策约束，而不仅受单个壳站政策约束。" },
        ],
      },
      faq: {
        label: "常见问题",
        title: "Climate Passport 帮助中心",
        intro: "Passport 的 FAQ 回答身份、档案、证书和审批等平台问题。",
        sections: [
          { title: "为什么要通过 Climate Passport 登录？", body: "因为账号归属、活动参与、证书和审批都统一由 Passport 平台管理。" },
          { title: "多个渠道可以共用同一账号吗？", body: "可以。Climate Passport 的目标是在多个渠道之间提供统一身份和记录档案。" },
        ],
      },
    },
    auth: {
      login: {
        kicker: "欢迎回来",
        title: "登录 Climate Passport",
        body:
          "访问你的可验证身份、凭证、参与记录和成就。",
        formLabel: "登录",
        formTitle: "输入你的账号信息",
        email: "邮箱地址",
        password: "密码",
        submit: "登录",
        switchCta: "创建账号",
        note: "初次使用 Climate Passport？创建账号，开始构建你的可验证气候档案。",
      },
      register: {
        formLabel: "创建账号",
        formTitle: "你的信息",
        name: "姓名",
        email: "邮箱地址",
        password: "密码",
        submit: "创建我的 Passport",
        switchCta: "返回登录",
        kicker: "加入 Climate Passport",
        title: "构建你的可验证气候档案。",
        body:
          "创建账号，开始获取可验证证书、出席记录和学习里程碑——属于你自己的记录。",
      },
    },
  },
};

function buildFrDictionary(base: SiteDictionary): SiteDictionary {
  return {
    ...base,
    shell: {
      ...base.shell,
      nav: [],
      switchLabel: "Langue",
      actions: {
        ...base.shell.actions,
        summerSchool: "Ecole d'ete",
        admin: "Admin",
        dashboard: "Tableau de bord",
        logout: "Se deconnecter",
        login: "Connexion",
        register: "Inscription",
      },
      footer: {
        ...base.shell.footer,
        sitemapTitle: "Plateforme",
        infoTitle: "Informations",
        infoLinks: [
          { href: "/about", label: "A propos" },
          { href: "/contact", label: "Contact" },
          { href: "/terms", label: "Conditions" },
          { href: "/privacy", label: "Confidentialite" },
          { href: "/faq", label: "FAQ" },
        ],
        shellTitle: "Commencer",
        certificateTitle: "Certificats",
      },
    },
    home: {
      ...base.home,
      kicker: "Infrastructure d'identite climatique",
      title: "Construire une infrastructure d'identite numerique de confiance pour l'ere climatique.",
      subtitle: "Pour la planete, pour vous, pour l'avenir",
      primaryCta: "Creer mon Passeport",
      secondaryCta: "Explorer les certificats",
      proofTitle: "Pourquoi Climate Passport",
      sectionLabel: "Fonctionnalites de la plateforme",
      sectionTitle: "Modules principaux",
      sectionBody: "Identity, events, certifications and learning records in one trusted platform.",
    },
    passport: {
      ...base.passport,
      label: "Passeport",
      title: "Votre identite climatique verifiable",
      intro: "Un profil personnel numerique verifie qui suit vos apprentissages, participations et certifications.",
    },
    certificates: {
      ...base.certificates,
      label: "Certificats",
      title: "Centre de certificats verifiables",
      intro: "Issuance, verification and download managed under one trusted lifecycle.",
    },
    events: {
      ...base.events,
      label: "Evenements",
      title: "Participation et verification d'evenements",
    },
    speakers: {
      ...base.speakers,
      label: "Personnes",
      title: "Personnes et partenaires",
    },
    notifications: {
      ...base.notifications,
      label: "Notifications",
      title: "Centre de notifications",
    },
    messages: {
      ...base.messages,
      label: "Messages",
      title: "Messages de support et de workflow",
    },
    info: {
      ...base.info,
      about: { ...base.info.about, label: "A propos de Climate Passport", title: "A propos de la plateforme Climate Passport" },
      contact: { ...base.info.contact, label: "Contact", title: "Contacter l'equipe Climate Passport" },
      terms: { ...base.info.terms, label: "Conditions", title: "Conditions d'utilisation de Climate Passport" },
      privacy: { ...base.info.privacy, label: "Confidentialite", title: "Politique de confidentialite de Climate Passport" },
      faq: { ...base.info.faq, label: "FAQ", title: "Centre d'aide Climate Passport" },
    },
    auth: {
      login: {
        ...base.auth.login,
        kicker: "Bienvenue",
        title: "Connexion a Climate Passport",
        formLabel: "Connexion",
        formTitle: "Saisissez vos identifiants",
        email: "Adresse e-mail",
        password: "Mot de passe",
        submit: "Se connecter",
        switchCta: "Creer un compte",
      },
      register: {
        ...base.auth.register,
        formLabel: "Creer un compte",
        formTitle: "Vos informations",
        name: "Nom",
        email: "Adresse e-mail",
        password: "Mot de passe",
        submit: "Creer mon Passeport",
        switchCta: "Retour a la connexion",
        kicker: "Rejoindre Climate Passport",
      },
    },
  };
}

function buildDeDictionary(base: SiteDictionary): SiteDictionary {
  return {
    ...base,
    shell: {
      ...base.shell,
      nav: [],
      switchLabel: "Sprache",
      actions: {
        ...base.shell.actions,
        summerSchool: "Summer School",
        admin: "Admin",
        dashboard: "Dashboard",
        logout: "Abmelden",
        login: "Anmelden",
        register: "Registrieren",
      },
      footer: {
        ...base.shell.footer,
        sitemapTitle: "Plattform",
        infoTitle: "Informationen",
        infoLinks: [
          { href: "/about", label: "Uber uns" },
          { href: "/contact", label: "Kontakt" },
          { href: "/terms", label: "Nutzungsbedingungen" },
          { href: "/privacy", label: "Datenschutz" },
          { href: "/faq", label: "FAQ" },
        ],
        shellTitle: "Erste Schritte",
        certificateTitle: "Zertifikate",
      },
    },
    home: {
      ...base.home,
      kicker: "Klima-Identitatsinfrastruktur",
      title: "Aufbau einer vertrauenswurdigen digitalen Identitatsinfrastruktur fur das Klima-Zeitalter.",
      subtitle: "Fur den Planeten, fur Sie, fur die Zukunft",
      primaryCta: "Mein Passport erstellen",
      secondaryCta: "Zertifikate entdecken",
      proofTitle: "Warum Climate Passport",
      sectionLabel: "Plattform-Funktionen",
      sectionTitle: "Kernmodule",
      sectionBody: "Identity, events, certifications and learning records in one trusted platform.",
    },
    passport: {
      ...base.passport,
      label: "Pass",
      title: "Ihre verifizierbare Klima-Identitat",
      intro: "Ein verifiziertes digitales Profil, das Lernen, Teilnahmen und Zertifikate dokumentiert.",
    },
    certificates: {
      ...base.certificates,
      label: "Zertifikate",
      title: "Hub fur verifizierbare Zertifikate",
      intro: "Issuance, verification and download managed under one trusted lifecycle.",
    },
    events: {
      ...base.events,
      label: "Events",
      title: "Teilnahme und Verifizierung von Events",
    },
    speakers: {
      ...base.speakers,
      label: "Personen",
      title: "Personen und Partner",
    },
    notifications: {
      ...base.notifications,
      label: "Benachrichtigungen",
      title: "Benachrichtigungszentrum",
    },
    messages: {
      ...base.messages,
      label: "Nachrichten",
      title: "Support- und Workflow-Nachrichten",
    },
    info: {
      ...base.info,
      about: { ...base.info.about, label: "Uber Climate Passport", title: "Uber die Climate Passport Plattform" },
      contact: { ...base.info.contact, label: "Kontakt", title: "Kontakt zum Climate Passport Team" },
      terms: { ...base.info.terms, label: "Nutzungsbedingungen", title: "Nutzungsbedingungen von Climate Passport" },
      privacy: { ...base.info.privacy, label: "Datenschutz", title: "Datenschutz bei Climate Passport" },
      faq: { ...base.info.faq, label: "FAQ", title: "Climate Passport Hilfezentrum" },
    },
    auth: {
      login: {
        ...base.auth.login,
        kicker: "Willkommen zuruck",
        title: "Bei Climate Passport anmelden",
        formLabel: "Anmeldung",
        formTitle: "Geben Sie Ihre Zugangsdaten ein",
        email: "E-Mail-Adresse",
        password: "Passwort",
        submit: "Anmelden",
        switchCta: "Konto erstellen",
      },
      register: {
        ...base.auth.register,
        formLabel: "Konto erstellen",
        formTitle: "Ihre Angaben",
        name: "Name",
        email: "E-Mail-Adresse",
        password: "Passwort",
        submit: "Meinen Passport erstellen",
        switchCta: "Zuruck zur Anmeldung",
        kicker: "Climate Passport beitreten",
      },
    },
  };
}

const localizedDictionaries: Record<Locale, SiteDictionary> = {
  en: siteContent.en,
  zh: siteContent.zh,
  fr: buildFrDictionary(siteContent.en),
  de: buildDeDictionary(siteContent.en),
};

/** Maps any locale to the nearest available translated locale */
export function toCoreLocale(locale: Locale | string): CoreLocale {
  return coreLocaleSet.has(locale) ? (locale as CoreLocale) : "en";
}

export function getDictionary(locale: Locale | string) {
  if (isSupportedLocale(locale)) {
    return localizedDictionaries[locale];
  }
  return localizedDictionaries.en;
}