import { getPrismaClient } from "@/lib/server/prisma";
import type { Locale } from "@/lib/site-content";

const PLATFORM_SITE_SETTING_KEY = "platform";

type SiteSettingRecord = {
  siteName: string;
  siteNameEn: string | null;
  shortName: string | null;
  tagline: string | null;
  taglineEn: string | null;
  logoColor: string | null;
  logoMono: string | null;
  favicon: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  supportWebsite: string | null;
  copyrightText: string | null;
  copyrightTextEn: string | null;
  icpNumber: string | null;
  themeColor: string | null;
  themeColorDark: string | null;
};

export type SiteBrandingView = {
  siteName: string;
  shortName: string | null;
  tagline: string | null;
  logoColor: string | null;
  logoMono: string | null;
  favicon: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  supportWebsite: string | null;
  copyrightText: string | null;
  icpNumber: string | null;
  themeColor: string | null;
  themeColorDark: string | null;
};

function isMissingTableError(error: unknown): boolean {
  return Boolean(
    error
      && typeof error === "object"
      && "code" in error
      && (error as { code?: string }).code === "P2021",
  );
}

function pickLocalized(locale: Locale, zhOrDefault: string | null, en: string | null) {
  if (locale === "zh") {
    return zhOrDefault;
  }

  return en ?? zhOrDefault;
}

export async function getSiteBranding(locale: Locale): Promise<SiteBrandingView | null> {
  const prisma = getPrismaClient();

  if (!prisma) {
    return null;
  }

  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: PLATFORM_SITE_SETTING_KEY },
      select: {
        siteName: true,
        siteNameEn: true,
        shortName: true,
        tagline: true,
        taglineEn: true,
        logoColor: true,
        logoMono: true,
        favicon: true,
        supportEmail: true,
        supportPhone: true,
        supportWebsite: true,
        copyrightText: true,
        copyrightTextEn: true,
        icpNumber: true,
        themeColor: true,
        themeColorDark: true,
      },
    }) as SiteSettingRecord | null;

    if (!setting) {
      return null;
    }

    return {
      siteName: pickLocalized(locale, setting.siteName, setting.siteNameEn) ?? setting.siteName,
      shortName: setting.shortName,
      tagline: pickLocalized(locale, setting.tagline, setting.taglineEn),
      logoColor: setting.logoColor,
      logoMono: setting.logoMono,
      favicon: setting.favicon,
      supportEmail: setting.supportEmail,
      supportPhone: setting.supportPhone,
      supportWebsite: setting.supportWebsite,
      copyrightText: pickLocalized(locale, setting.copyrightText, setting.copyrightTextEn),
      icpNumber: setting.icpNumber,
      themeColor: setting.themeColor,
      themeColorDark: setting.themeColorDark,
    };
  } catch (error) {
    if (isMissingTableError(error)) {
      return null;
    }

    throw error;
  }
}

export { PLATFORM_SITE_SETTING_KEY };
