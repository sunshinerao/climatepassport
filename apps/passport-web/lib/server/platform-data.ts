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

function isMissingTableError(error: unknown) {
  return Boolean(
    error
      && typeof error === "object"
      && "code" in error
      && (error as { code?: string }).code === "P2021",
  );
}

function parseLearningHours(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.trim());
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  return 0;
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

const DEFAULT_POINT_ACHIEVEMENTS = [
  {
    key: "climate-first-step",
    name: "气候行动起步者",
    nameEn: "Climate First Step",
    description: "累计获得 100 积分，完成你的第一阶段气候行动记录。",
    descriptionEn: "Accumulate 100 points to complete your first stage of climate action records.",
    pointThreshold: 100,
    order: 10,
  },
  {
    key: "community-participant",
    name: "社区参与者",
    nameEn: "Community Participant",
    description: "累计获得 250 积分，持续参与活动与学习。",
    descriptionEn: "Accumulate 250 points through sustained event and learning participation.",
    pointThreshold: 250,
    order: 20,
  },
  {
    key: "learning-practitioner",
    name: "学习践行者",
    nameEn: "Learning Practitioner",
    description: "累计获得 500 积分，形成稳定的学习与实践闭环。",
    descriptionEn: "Accumulate 500 points to form a stable learning-to-practice loop.",
    pointThreshold: 500,
    order: 30,
  },
  {
    key: "impact-builder",
    name: "影响力建设者",
    nameEn: "Impact Builder",
    description: "累计获得 800 积分，具备可验证的影响力轨迹。",
    descriptionEn: "Accumulate 800 points and build a verifiable impact trajectory.",
    pointThreshold: 800,
    order: 40,
  },
  {
    key: "certificate-achiever",
    name: "证书达成者",
    nameEn: "Certificate Achiever",
    description: "累计获得 1200 积分，解锁更高阶的成果证明。",
    descriptionEn: "Accumulate 1200 points to unlock higher-level credential outcomes.",
    pointThreshold: 1200,
    order: 50,
  },
  {
    key: "global-collaborator",
    name: "全球协作贡献者",
    nameEn: "Global Collaboration Contributor",
    description: "累计获得 1600 积分，形成跨区域协作贡献。",
    descriptionEn: "Accumulate 1600 points and demonstrate cross-region collaboration.",
    pointThreshold: 1600,
    order: 60,
  },
  {
    key: "climate-champion",
    name: "气候先锋",
    nameEn: "Climate Champion",
    description: "累计获得 2100 积分，成为平台内高可信行动者。",
    descriptionEn: "Accumulate 2100 points and become a trusted high-impact actor on the platform.",
    pointThreshold: 2100,
    order: 70,
  },
  {
    key: "milestone-guardian",
    name: "里程守护者",
    nameEn: "Milestone Guardian",
    description: "累计获得 2600 积分，持续守护长期气候目标。",
    descriptionEn: "Accumulate 2600 points while consistently safeguarding long-term climate goals.",
    pointThreshold: 2600,
    order: 80,
  },
  {
    key: "legacy-architect",
    name: "行动传承构建者",
    nameEn: "Legacy Architect",
    description: "累计获得 3200 积分，建立高价值气候行动传承。",
    descriptionEn: "Accumulate 3200 points to establish a high-value climate action legacy.",
    pointThreshold: 3200,
    order: 90,
  },
] as const;

async function ensureDefaultPointAchievementDefinitions(
  prisma: NonNullable<ReturnType<typeof getPrismaClient>>,
) {
  const existing = await prisma.achievementDefinition.findMany({
    where: {
      key: {
        in: DEFAULT_POINT_ACHIEVEMENTS.map((item) => item.key),
      },
    },
    select: { key: true },
  });

  const existingKeys = new Set(existing.map((item) => item.key));
  const missing = DEFAULT_POINT_ACHIEVEMENTS.filter((item) => !existingKeys.has(item.key));

  if (missing.length > 0) {
    await prisma.achievementDefinition.createMany({
      data: missing.map((item) => ({
        key: item.key,
        name: item.name,
        nameEn: item.nameEn,
        description: item.description,
        descriptionEn: item.descriptionEn,
        pointThreshold: item.pointThreshold,
        order: item.order,
        isActive: true,
      })),
      skipDuplicates: true,
    });
  }
}

export async function getHomePageData(locale: Locale) {
  const dictionary = getDictionary(locale);

  return withPrismaFallback(
    async (prisma) => {
      const [passportHolderCount, eventCount, certificateCount, checkinCount, upcomingEvents] = await Promise.all([
        prisma.user.count({ where: { climatePassportId: { not: null } } }),
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
            { ...dictionary.home.metrics[0], value: passportHolderCount.toLocaleString(locale === "zh" ? "zh-CN" : "en-US") },
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
      const now = new Date();
      await ensureDefaultPointAchievementDefinitions(prisma);

      const [user, achievementDefinitions] = await Promise.all([
        prisma.user.findFirst({
          where: currentUser ? { id: currentUser.id } : { status: "ACTIVE" },
          orderBy: currentUser ? undefined : { createdAt: "asc" },
          include: {
            unlockedAchievements: {
              include: {
                achievementDefinition: true,
              },
              orderBy: { unlockedAt: "desc" },
            },
            registrations: {
              include: {
                event: {
                  select: {
                    id: true,
                    title: true,
                    titleEn: true,
                    venue: true,
                    venueEn: true,
                    startDate: true,
                    endDate: true,
                    isPublished: true,
                    isClosed: true,
                  },
                },
              },
              orderBy: { createdAt: "desc" },
            },
            certificateIssues: {
              where: { status: "ISSUED" },
              include: {
                definition: {
                  select: {
                    name: true,
                    nameEn: true,
                    category: {
                      select: {
                        key: true,
                        name: true,
                        nameEn: true,
                      },
                    },
                  },
                },
              },
              orderBy: { issuedAt: "desc" },
              take: 6,
            },
            learningExperienceParticipations: {
              where: {
                status: "COMPLETED",
              },
              select: {
                startedAt: true,
                completedAt: true,
                program: {
                  select: {
                    cohortStartAt: true,
                    cohortEndAt: true,
                    programConfigJson: true,
                  },
                },
              },
            },
          },
        }),
        prisma.achievementDefinition.findMany({
          where: { isActive: true },
          orderBy: [{ order: "asc" }, { pointThreshold: "asc" }, { createdAt: "asc" }],
          take: 9,
        }),
      ]);

      let achievementTimelineRows: Array<{
        id: string;
        name: string;
        description: string | null;
        verificationLevel: string;
        completedAt: Date | null;
        createdAt: Date;
      }> = [];
      let badgeDefinitionRows: Array<{
        id: string;
        name: string;
        nameZh: string | null;
        description: string | null;
        descriptionZh: string | null;
        verificationGrade: string;
      }> = [];
      let activeBadgeAwardRows: Array<{ badgeDefinitionId: string }> = [];

      if (user) {
        try {
          [achievementTimelineRows, badgeDefinitionRows, activeBadgeAwardRows] = await Promise.all([
            prisma.achievement.findMany({
              where: { userId: user.id },
              orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
              take: 8,
              select: {
                id: true,
                name: true,
                description: true,
                verificationLevel: true,
                completedAt: true,
                createdAt: true,
              },
            }),
            prisma.badgeDefinition.findMany({
              where: { isActive: true },
              orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
              take: 12,
              select: {
                id: true,
                name: true,
                nameZh: true,
                description: true,
                descriptionZh: true,
                verificationGrade: true,
              },
            }),
            prisma.badgeAward.findMany({
              where: { userId: user.id, status: "ACTIVE" },
              select: { badgeDefinitionId: true },
            }),
          ]);
        } catch (error) {
          if (!isMissingTableError(error)) {
            throw error;
          }
        }
      }

      if (!user) {
        return {
          locale,
          passport: dictionary.passport,
          account: {
            ...accountSnapshotByLocale[toCoreLocale(locale)],
            certificates: 0,
          },
          timeline: [] as Array<{ day: string; month: string; title: string; meta: string; href: string; cta: string; primary: boolean }>,
          certificates: [] as Array<{ icon: string; title: string; issuer: string; date: string; href: string; code: string | null }>,
          profileCompletion: 0,
          achievementTimeline: [] as Array<{ id: string; name: string; description: string | null; verificationLevel: string; dateLabel: string; monthLabel: string; dayLabel: string }>,
          badgeWall: [] as Array<{ id: string; name: string; description: string | null; verificationGrade: string; unlocked: boolean }>,
        };
      }

      const attendedRegistrations = user.registrations.filter((registration) => registration.status === "ATTENDED");
      const learningHoursFromEvents = attendedRegistrations.reduce((sum, registration) => {
        if (!registration.event?.startDate || !registration.event?.endDate) {
          return sum;
        }

        const hours = (registration.event.endDate.getTime() - registration.event.startDate.getTime()) / (1000 * 60 * 60);
        return sum + Math.max(0, hours);
      }, 0);

      const learningHoursFromPrograms = user.learningExperienceParticipations.reduce((sum, participation) => {
        const config = participation.program?.programConfigJson;
        const configHours = config && typeof config === "object" && !Array.isArray(config)
          ? parseLearningHours((config as Record<string, unknown>).learningHours)
            || parseLearningHours((config as Record<string, unknown>).hours)
            || parseLearningHours((config as Record<string, unknown>).durationHours)
            || parseLearningHours((config as Record<string, unknown>).totalHours)
            || parseLearningHours((config as Record<string, unknown>).creditHours)
          : 0;

        if (configHours > 0) {
          return sum + configHours;
        }

        const start = participation.startedAt
          ?? participation.program?.cohortStartAt
          ?? null;
        const end = participation.completedAt
          ?? participation.program?.cohortEndAt
          ?? null;

        if (!start || !end) {
          return sum;
        }

        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        return sum + Math.max(0, hours);
      }, 0);

      const timeline = user.registrations
        .filter((registration) => {
          if (!registration.event) {
            return false;
          }

          if (!["REGISTERED", "PENDING_APPROVAL", "WAITLIST"].includes(registration.status)) {
            return false;
          }

          if (registration.event.startDate < now || !registration.event.isPublished || registration.event.isClosed) {
            return false;
          }

          return true;
        })
        .sort((a, b) => a.event.startDate.getTime() - b.event.startDate.getTime())
        .slice(0, 3)
        .map((registration, index) => {
          const eventDate = registration.event.startDate;
          const month = locale === "zh"
            ? `${eventDate.getMonth() + 1}月`
            : eventDate.toLocaleDateString("en-US", { month: "short" });
          const day = String(eventDate.getDate()).padStart(2, "0");
          const title = getLocalizedText(locale, registration.event.title, registration.event.titleEn);
          const venue = getLocalizedText(locale, registration.event.venue, registration.event.venueEn) || (locale === "zh" ? "线上活动" : "Virtual Event");
          const time = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: locale !== "zh",
            timeZone: "Asia/Shanghai",
          }).format(eventDate);

          const cta = registration.status === "REGISTERED"
            ? (locale === "zh" ? "加入" : "Join")
            : (locale === "zh" ? "详情" : "Details");

          return {
            day,
            month,
            title,
            meta: `${venue}${locale === "zh" ? "，" : ", "}${time}`,
            href: `/${locale}/events`,
            cta,
            primary: index === 0 && registration.status === "REGISTERED",
          };
        });

      const recentCertificates = user.certificateIssues.slice(0, 2).map((issue) => {
        const categoryKey = issue.definition.category.key.toLowerCase();
        const icon = categoryKey.includes("learning") ? "📘" : categoryKey.includes("achievement") ? "🏆" : "🎓";
        const title = getLocalizedText(locale, issue.definition.name, issue.definition.nameEn);
        const issuer = locale === "zh" ? "签发机构：Climate Passport" : "Issued by Climate Passport";

        return {
          icon,
          title,
          issuer,
          date: formatDateLabel(locale, issue.issuedAt ?? issue.createdAt),
          href: issue.verificationCode ? `/${locale}/verify/certificate/${encodeURIComponent(issue.verificationCode)}` : `/${locale}/dashboard/certificates`,
          code: issue.verificationCode,
        };
      });

      const completionChecks = [
        Boolean(user.name),
        Boolean(user.email),
        Boolean(user.phone),
        Boolean(user.title),
        Boolean(user.bio),
        Boolean(user.country),
        Boolean(user.avatar),
        Boolean(user.climatePassportId),
      ];
      const profileCompletion = Math.round((completionChecks.filter(Boolean).length / completionChecks.length) * 100);

      const unlockedDefinitionIds = new Set(
        user.unlockedAchievements.map((item) => item.achievementDefinitionId),
      );

      const pointUnlockedDefinitions = achievementDefinitions.filter((definition) => {
        if (typeof definition.pointThreshold !== "number") {
          return false;
        }

        return user.points >= definition.pointThreshold;
      });

      const newlyUnlocked = pointUnlockedDefinitions.filter(
        (definition) => !unlockedDefinitionIds.has(definition.id),
      );

      if (newlyUnlocked.length > 0) {
        await prisma.userAchievement.createMany({
          data: newlyUnlocked.map((definition) => ({
            userId: user.id,
            achievementDefinitionId: definition.id,
            sourceType: "POINT_THRESHOLD",
            sourceId: `point-threshold:${definition.id}`,
          })),
          skipDuplicates: true,
        });

        for (const definition of newlyUnlocked) {
          unlockedDefinitionIds.add(definition.id);
        }
      }

      const achievementsList = achievementDefinitions.length > 0
        ? achievementDefinitions.map((definition) => {
            const isUnlocked = unlockedDefinitionIds.has(definition.id);
            const threshold = typeof definition.pointThreshold === "number" ? definition.pointThreshold : 0;

            return {
              title: getLocalizedText(locale, definition.name, definition.nameEn),
              detail: isUnlocked
                ? locale === "zh"
                  ? `已达成 · ${threshold} 积分阈值`
                  : `Unlocked · ${threshold} point threshold`
                : locale === "zh"
                  ? `解锁条件：累计 ${threshold} 积分`
                  : `Unlock requirement: ${threshold} total points`,
              unlocked: isUnlocked,
            };
          })
        : dictionary.passport.achievementsList;

      const unlockedCount = achievementsList.filter((item) => item.unlocked).length;
      const achievementTimeline = achievementTimelineRows.map((item) => {
        const date = item.completedAt ?? item.createdAt;

        return {
          id: item.id,
          name: item.name,
          description: item.description,
          verificationLevel: item.verificationLevel,
          dateLabel: formatDateLabel(locale, date),
          monthLabel: date.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { month: "short" }),
          dayLabel: String(date.getDate()),
        };
      });

      const unlockedBadgeSet = new Set(activeBadgeAwardRows.map((item) => item.badgeDefinitionId));
      const badgeWall = badgeDefinitionRows.map((item) => ({
        id: item.id,
        name: locale === "zh" ? item.nameZh ?? item.name : item.name,
        description: locale === "zh" ? item.descriptionZh ?? item.description : item.description ?? item.descriptionZh,
        verificationGrade: item.verificationGrade,
        unlocked: unlockedBadgeSet.has(item.id),
      }));

      return {
        locale,
        passport: {
          ...dictionary.passport,
          achievementsList,
        },
        account: {
          name: user.name,
          role: user.title ?? accountSnapshotByLocale[toCoreLocale(locale)].role,
          climatePassportId: user.climatePassportId ?? user.passCode,
          points: user.points,
          attended: attendedRegistrations.length,
          learningHours: Math.round(Math.max(0, learningHoursFromEvents + learningHoursFromPrograms)),
          certificates: user.certificateIssues.length,
          achievements: unlockedCount,
          issuedAt: formatDateLabel(locale, user.certificateIssues[0]?.issuedAt ?? user.createdAt),
        },
        timeline,
        certificates: recentCertificates,
        profileCompletion,
        achievementTimeline,
        badgeWall,
      };
    },
    async () => ({
      locale,
      passport: dictionary.passport,
      account: {
        ...accountSnapshotByLocale[toCoreLocale(locale)],
        certificates: 0,
      },
      timeline: [] as Array<{ day: string; month: string; title: string; meta: string; href: string; cta: string; primary: boolean }>,
      certificates: [] as Array<{ icon: string; title: string; issuer: string; date: string; href: string; code: string | null }>,
      profileCompletion: 0,
      achievementTimeline: [] as Array<{ id: string; name: string; description: string | null; verificationLevel: string; dateLabel: string; monthLabel: string; dayLabel: string }>,
      badgeWall: [] as Array<{ id: string; name: string; description: string | null; verificationGrade: string; unlocked: boolean }>,
    }),
  );
}

export async function getProfileMaintenancePageData(locale: Locale) {
  const dictionary = getDictionary(locale);
  const currentUser = await getCurrentUser();

  return withPrismaFallback(
    async (prisma) => {
      const user = await prisma.user.findFirst({
        where: currentUser ? { id: currentUser.id } : { status: "ACTIVE" },
        orderBy: currentUser ? undefined : { createdAt: "asc" },
        include: {
          organization: {
            select: {
              name: true,
              website: true,
              description: true,
            },
          },
        },
      });

      if (!user) {
        return {
          locale,
          profile: {
            name: "",
            email: "",
            climatePassportId: "",
            salutation: "",
            phone: "",
            country: "",
            title: "",
            avatar: "",
            bio: "",
            organization: {
              name: "",
              website: "",
              description: "",
            },
          },
          dictionary,
        };
      }

      return {
        locale,
        profile: {
          name: user.name,
          email: user.email,
          climatePassportId: user.climatePassportId ?? user.passCode,
          salutation: user.salutation ?? "",
          phone: user.phone ?? "",
          country: user.country ?? "",
          title: user.title ?? "",
          avatar: user.avatar ?? "",
          bio: user.bio ?? "",
          organization: {
            name: user.organization?.name ?? "",
            website: user.organization?.website ?? "",
            description: user.organization?.description ?? "",
          },
        },
        dictionary,
      };
    },
    async () => ({
      locale,
      profile: {
        name: "",
        email: "",
        climatePassportId: "",
        salutation: "",
        phone: "",
        country: "",
        title: "",
        avatar: "",
        bio: "",
        organization: {
          name: "",
          website: "",
          description: "",
        },
      },
      dictionary,
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
