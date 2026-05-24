import { getPrismaClient } from "@/lib/server/prisma";
import { getCurrentUser } from "@/lib/server/auth";
import { accountSnapshotByLocale, getDictionary, toCoreLocale, type Locale } from "@/lib/site-content";

function getLocalizedText(locale: Locale, zh: string | null | undefined, en: string | null | undefined) {
  if (locale === "zh") {
    return zh ?? en ?? "";
  }

  return en ?? zh ?? "";
}

function formatDateLabel(locale: Locale, value: Date | string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(date);
}

async function withPrismaFallback<T>(resolver: (client: NonNullable<ReturnType<typeof getPrismaClient>>) => Promise<T>, fallback: () => T | Promise<T>) {
  const client = getPrismaClient();

  if (!client) {
    return fallback();
  }

  try {
    return await resolver(client);
  } catch (error) {
    console.error("[platform-data] Prisma query failed; rendering fallback content.", error);
    return fallback();
  }
}

export async function getHomePageData(locale: Locale) {
  const dictionary = getDictionary(locale);

  return withPrismaFallback(
    async (prisma) => {
      const [userCount, eventCount, certificateCount, checkinCount, upcomingEvents] = await Promise.all([
        prisma.user.count(),
        prisma.event.count({ where: { isPublished: true } }),
        prisma.certificateIssue.count({ where: { status: "ISSUED" } }),
        prisma.checkIn.count(),
        prisma.event.findMany({
          where: { isPublished: true },
          orderBy: [{ isPinned: "desc" }, { startDate: "asc" }],
          take: 3,
          select: {
            id: true,
            title: true,
            titleEn: true,
            venue: true,
            venueEn: true,
            startDate: true,
            endDate: true,
            isClosed: true,
          },
        }),
      ]);

      const dateRangeSeparator = locale === "zh" ? " 至 " : " to ";

      return {
        locale,
        home: {
          ...dictionary.home,
          metrics: [
            { ...dictionary.home.metrics[0], value: userCount.toLocaleString(locale === "zh" ? "zh-CN" : "en-US") },
            { ...dictionary.home.metrics[1], value: eventCount.toLocaleString(locale === "zh" ? "zh-CN" : "en-US") },
            { ...dictionary.home.metrics[2], value: certificateCount.toLocaleString(locale === "zh" ? "zh-CN" : "en-US") },
            { ...dictionary.home.metrics[3], value: checkinCount.toLocaleString(locale === "zh" ? "zh-CN" : "en-US") },
          ],
        },
        upcomingEvents: upcomingEvents.map((event) => ({
          id: event.id,
          title: getLocalizedText(locale, event.title, event.titleEn),
          venue: getLocalizedText(locale, event.venue, event.venueEn),
          startDate: event.startDate,
          dateRange: `${formatDateLabel(locale, event.startDate)}${dateRangeSeparator}${formatDateLabel(locale, event.endDate)}`,
          status: event.isClosed
            ? (locale === "zh" ? "已结束" : "Ended")
            : (locale === "zh" ? "即将开始" : "Upcoming"),
        })),
      };
    },
    async () => ({
      locale,
      home: dictionary.home,
      upcomingEvents: [] as { id: string; title: string; venue: string; startDate: Date | null; dateRange: string; status: string }[],
    }),
  );
}

export async function getPassportPageData(locale: Locale) {
  const dictionary = getDictionary(locale);
  const currentUser = await getCurrentUser();

  return withPrismaFallback(
    async (prisma) => {
      const user = await prisma.user.findFirst({
        where: currentUser ? { id: currentUser.id } : { status: "ACTIVE" },
        orderBy: currentUser ? undefined : { createdAt: "asc" },
        include: {
          unlockedAchievements: {
            include: {
              achievementDefinition: true,
            },
            orderBy: { unlockedAt: "desc" },
            take: 4,
          },
          registrations: {
            where: { status: "ATTENDED" },
            select: { id: true },
          },
          certificateIssues: {
            where: { status: "ISSUED" },
            select: { id: true, issuedAt: true },
            orderBy: { issuedAt: "desc" },
            take: 1,
          },
        },
      });

      if (!user) {
        return {
          locale,
          passport: dictionary.passport,
          account: accountSnapshotByLocale[toCoreLocale(locale)],
        };
      }

      return {
        locale,
        passport: {
          ...dictionary.passport,
          achievementsList:
            user.unlockedAchievements.length > 0
              ? user.unlockedAchievements.map((item) => ({
                  title: getLocalizedText(locale, item.achievementDefinition.name, item.achievementDefinition.nameEn),
                  detail: getLocalizedText(
                    locale,
                    item.achievementDefinition.description,
                    item.achievementDefinition.descriptionEn,
                  ),
                  unlocked: true,
                }))
              : dictionary.passport.achievementsList,
        },
        account: {
          name: user.name,
          role: user.title ?? accountSnapshotByLocale[toCoreLocale(locale)].role,
          climatePassportId: user.climatePassportId ?? user.passCode,
          points: user.points,
          attended: user.registrations.length,
          learningHours: accountSnapshotByLocale[toCoreLocale(locale)].learningHours,
          achievements: user.unlockedAchievements.length,
          issuedAt: formatDateLabel(locale, user.certificateIssues[0]?.issuedAt ?? user.createdAt),
        },
      };
    },
    async () => ({
      locale,
      passport: dictionary.passport,
      account: accountSnapshotByLocale[toCoreLocale(locale)],
    }),
  );
}

export async function getCertificatesPageData(locale: Locale) {
  const dictionary = getDictionary(locale);

  return withPrismaFallback(
    async (prisma) => {
      const [categories, issues, verifications] = await Promise.all([
        prisma.certificateCategory.findMany({
          where: { isActive: true },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          include: {
            templates: {
              where: { isActive: true },
              select: { id: true },
            },
          },
          take: 3,
        }),
        prisma.certificateIssue.findMany({
          orderBy: { createdAt: "desc" },
          take: 3,
          include: {
            user: { select: { name: true } },
            definition: { select: { name: true, nameEn: true, pointReward: true } },
          },
        }),
        prisma.certificateVerification.findMany({
          orderBy: { verifiedAt: "desc" },
          take: 2,
          include: {
            certificateIssue: { select: { verificationCode: true, issuedAt: true, definition: { select: { name: true, nameEn: true } } } },
          },
        }),
      ]);

      return {
        locale,
        certificates: {
          ...dictionary.certificates,
          categories:
            categories.length > 0
              ? categories.map((category) => ({
                  name: getLocalizedText(locale, category.name, category.nameEn),
                  rule: getLocalizedText(locale, category.description, category.descriptionEn) || dictionary.certificates.categories[0]?.rule || "",
                  templates: category.templates.length,
                  status: category.isActive
                    ? locale === "zh"
                      ? "已激活"
                      : "Active"
                    : locale === "zh"
                      ? "已停用"
                      : "Inactive",
                }))
              : dictionary.certificates.categories,
          queue:
            issues.length > 0
              ? issues.map((issue) => ({
                  recipient: issue.user.name,
                  definition: getLocalizedText(locale, issue.definition.name, issue.definition.nameEn),
                  status: issue.status,
                  linkedOutcome:
                    issue.definition.pointReward && issue.definition.pointReward > 0
                      ? locale === "zh"
                        ? `+${issue.definition.pointReward} 积分`
                        : `+${issue.definition.pointReward} points`
                      : locale === "zh"
                        ? "已关联 Passport 档案"
                        : "Linked to Passport archive",
                }))
              : dictionary.certificates.queue,
          checks:
            verifications.length > 0
              ? verifications.map((check) => ({
                  code: check.certificateIssue.verificationCode ?? "N/A",
                  result: check.result,
                  detail:
                    `${getLocalizedText(locale, check.certificateIssue.definition.name, check.certificateIssue.definition.nameEn)} · ${formatDateLabel(locale, check.verifiedAt)}`,
                }))
              : dictionary.certificates.checks,
        },
      };
    },
    async () => ({
      locale,
      certificates: dictionary.certificates,
    }),
  );
}

export async function getEventsPageData(locale: Locale) {
  const dictionary = getDictionary(locale);

  return withPrismaFallback(
    async (prisma) => {
      const [events, checkins, agendaItems] = await Promise.all([
        prisma.event.findMany({
          orderBy: [{ isPinned: "desc" }, { startDate: "asc" }],
          take: 3,
          select: {
            id: true,
            title: true,
            titleEn: true,
            venue: true,
            venueEn: true,
            startDate: true,
            endDate: true,
            requireApproval: true,
            isClosed: true,
          },
        }),
        prisma.checkIn.findMany({
          orderBy: { scannedAt: "desc" },
          take: 3,
          include: {
            event: { select: { title: true, titleEn: true } },
            user: { select: { name: true } },
          },
        }),
        prisma.agendaItem.findMany({
          orderBy: [{ agendaDate: "asc" }, { startTime: "asc" }, { order: "asc" }],
          take: 5,
          include: {
            event: { select: { title: true, titleEn: true } },
            speakers: { select: { name: true, nameEn: true } },
            moderator: { select: { name: true, nameEn: true } },
          },
        }),
      ]);

      const dateRangeSeparator = locale === "zh" ? " 至 " : " to ";

      return {
        locale,
        events: {
          ...dictionary.events,
          cards:
            events.length > 0
              ? events.map((event) => ({
                  title: getLocalizedText(locale, event.title, event.titleEn),
                  window: `${formatDateLabel(locale, event.startDate)}${dateRangeSeparator}${formatDateLabel(locale, event.endDate)}`,
                  venue: getLocalizedText(locale, event.venue, event.venueEn),
                  status: event.isClosed
                    ? locale === "zh"
                      ? "已关闭"
                      : "Closed"
                    : event.requireApproval
                      ? locale === "zh"
                        ? "需审批"
                        : "Approval required"
                      : locale === "zh"
                        ? "报名开放中"
                        : "Registration open",
                }))
              : dictionary.events.cards,
          agenda:
            agendaItems.length > 0
              ? agendaItems.map((item) => {
                  const speakerNames = item.speakers
                    .map((speaker) => getLocalizedText(locale, speaker.name, speaker.nameEn))
                    .filter(Boolean);
                  const moderatorName = item.moderator
                    ? getLocalizedText(locale, item.moderator.name, item.moderator.nameEn)
                    : "";

                  return {
                    time: `${formatDateLabel(locale, item.agendaDate)} ${item.startTime}-${item.endTime}`,
                    title: getLocalizedText(locale, item.title, item.titleEn),
                    detail:
                      getLocalizedText(locale, item.description, item.descriptionEn) ||
                      getLocalizedText(locale, item.event.title, item.event.titleEn),
                    speakers:
                      speakerNames.length > 0
                        ? speakerNames.join(locale === "zh" ? "、" : ", ")
                        : moderatorName || (locale === "zh" ? "待补充嘉宾" : "Speaker details pending"),
                  };
                })
              : dictionary.events.agenda,
          timeline:
            checkins.length > 0
              ? checkins.map((item) => ({
                  time: new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                    timeZone: "Asia/Shanghai",
                  }).format(item.scannedAt),
                  title:
                    locale === "zh"
                      ? `${item.user.name} 已完成签到`
                      : `${item.user.name} completed check-in`,
                  detail:
                    item.event
                      ? getLocalizedText(locale, item.event.title, item.event.titleEn)
                      : locale === "zh"
                        ? "未关联具体活动"
                        : "No linked event",
                }))
              : dictionary.events.timeline,
        },
      };
    },
    async () => ({
      locale,
      events: dictionary.events,
    }),
  );
}

export async function getLoginPageData(locale: Locale) {
  const dictionary = getDictionary(locale);

  return {
    locale,
    login: dictionary.auth.login,
  };
}

export async function getRegisterPageData(locale: Locale) {
  const dictionary = getDictionary(locale);

  return {
    locale,
    register: dictionary.auth.register,
  };
}

export async function getSpeakersPageData(locale: Locale) {
  const dictionary = getDictionary(locale);

  return withPrismaFallback(
    async (prisma) => {
      const speakers = await prisma.speaker.findMany({
        where: { isVisible: true },
        orderBy: [{ isKeynote: "desc" }, { order: "asc" }, { createdAt: "asc" }],
        take: 6,
        include: {
          roles: {
            orderBy: [{ isCurrent: "desc" }, { order: "asc" }],
            take: 2,
          },
        },
      });

      return {
        locale,
        speakers: {
          ...dictionary.speakers,
          cards:
            speakers.length > 0
              ? speakers.map((speaker) => {
                  const primaryRole = speaker.roles[0];

                  return {
                    name: getLocalizedText(locale, speaker.name, speaker.nameEn),
                    role:
                      getLocalizedText(locale, primaryRole?.title ?? speaker.title, primaryRole?.titleEn ?? speaker.titleEn) ||
                      (locale === "zh" ? "嘉宾" : "Speaker"),
                    organization:
                      getLocalizedText(
                        locale,
                        primaryRole?.organization ?? speaker.organization,
                        primaryRole?.organizationEn ?? speaker.organizationEn,
                      ) || (locale === "zh" ? "机构待补充" : "Organization pending"),
                    region:
                      getLocalizedText(locale, speaker.countryOrRegion, speaker.countryOrRegionEn) ||
                      (locale === "zh" ? "地区待补充" : "Region pending"),
                    tags: Array.isArray(speaker.expertiseTags)
                      ? speaker.expertiseTags.filter((tag): tag is string => typeof tag === "string").slice(0, 3)
                      : [],
                    status: speaker.isKeynote
                      ? locale === "zh"
                        ? "主旨嘉宾"
                        : "Keynote"
                      : speaker.roles.some((role) => role.isCurrent)
                        ? locale === "zh"
                          ? "当前嘉宾"
                          : "Current speaker"
                        : locale === "zh"
                          ? "嘉宾档案"
                          : "Speaker profile",
                  };
                })
              : dictionary.speakers.cards,
        },
      };
    },
    async () => ({
      locale,
      speakers: dictionary.speakers,
    }),
  );
}

export async function getNotificationsPageData(locale: Locale) {
  const dictionary = getDictionary(locale);
  const currentUser = await getCurrentUser();

  return withPrismaFallback(
    async (prisma) => {
      const [preferences, notifications] = currentUser
        ? await Promise.all([
            prisma.notificationPreference.findUnique({
              where: { userId: currentUser.id },
            }),
            prisma.notification.findMany({
              where: { userId: currentUser.id },
              orderBy: [{ deliveredAt: "desc" }, { createdAt: "desc" }],
              take: 5,
            }),
          ])
        : [null, []];

      const channels = [
        {
          title: dictionary.notifications.channels[0].title,
          description: dictionary.notifications.channels[0].description,
          status: preferences?.inAppEnabled ? (locale === "zh" ? "已开启" : "Enabled") : (locale === "zh" ? "未开启" : "Disabled"),
        },
        {
          title: dictionary.notifications.channels[1].title,
          description: dictionary.notifications.channels[1].description,
          status: preferences?.emailEnabled ? (locale === "zh" ? "已开启" : "Enabled") : (locale === "zh" ? "未开启" : "Disabled"),
        },
        {
          title: dictionary.notifications.channels[2].title,
          description: dictionary.notifications.channels[2].description,
          status: preferences?.smsEnabled ? (locale === "zh" ? "已开启" : "Enabled") : (locale === "zh" ? "未开启" : "Disabled"),
        },
      ];

      const items = notifications.map((item) => ({
        title: getLocalizedText(locale, item.title, item.titleEn),
        detail: `${getLocalizedText(locale, item.body, item.bodyEn)} · ${formatDateLabel(locale, item.deliveredAt ?? item.createdAt)}`,
        status: item.status,
      }));

      return {
        locale,
        notifications: {
          ...dictionary.notifications,
          channels,
          items: items.length > 0 ? items : dictionary.notifications.items,
        },
      };
    },
    async () => ({
      locale,
      notifications: dictionary.notifications,
    }),
  );
}

export async function getMessagesPageData(locale: Locale) {
  const dictionary = getDictionary(locale);
  const currentUser = await getCurrentUser();

  return withPrismaFallback(
    async (prisma) => {
      const [contactMessages, invitationRequests, specialPasses] = currentUser
        ? await Promise.all([
            prisma.contactMessage.findMany({
              where: { userId: currentUser.id },
              orderBy: { updatedAt: "desc" },
              take: 3,
            }),
            prisma.invitationRequest.findMany({
              where: { userId: currentUser.id },
              orderBy: { updatedAt: "desc" },
              take: 3,
              include: {
                event: { select: { title: true, titleEn: true } },
              },
            }),
            prisma.specialPass.findMany({
              where: { userId: currentUser.id },
              orderBy: { updatedAt: "desc" },
              take: 2,
            }),
          ])
        : [[], [], []];

      const threads = [
        ...contactMessages.map((message) => ({
          subject: message.subject,
          counterpart: locale === "zh" ? "Passport 支持团队" : "Passport support team",
          status: message.status,
          detail: message.adminReply || message.message,
        })),
        ...invitationRequests.map((request) => ({
          subject:
            locale === "zh"
              ? `邀请函申请：${request.guestName}`
              : `Invitation request: ${request.guestName}`,
          counterpart: locale === "zh" ? "Passport 运营" : "Passport operations",
          status: request.status,
          detail:
            request.event
              ? getLocalizedText(locale, request.event.title, request.event.titleEn)
              : request.rejectReason || request.notes || (locale === "zh" ? "等待处理更新" : "Awaiting workflow update"),
        })),
        ...specialPasses.map((specialPass) => ({
          subject:
            locale === "zh"
              ? `特别通行证：${specialPass.name}`
              : `Special pass: ${specialPass.name}`,
          counterpart: locale === "zh" ? "准入团队" : "Access team",
          status: specialPass.status,
          detail:
            specialPass.adminNotes ||
            (locale === "zh"
              ? `${specialPass.country} · ${specialPass.entryType}`
              : `${specialPass.country} · ${specialPass.entryType}`),
        })),
      ].slice(0, 5);

      return {
        locale,
        messages: {
          ...dictionary.messages,
          threads: threads.length > 0 ? threads : dictionary.messages.threads,
        },
      };
    },
    async () => ({
      locale,
      messages: dictionary.messages,
    }),
  );
}

export async function getInfoPageData(
  locale: Locale,
  page: keyof ReturnType<typeof getDictionary>["info"],
) {
  const dictionary = getDictionary(locale);

  return {
    locale,
    page: dictionary.info[page],
  };
}
