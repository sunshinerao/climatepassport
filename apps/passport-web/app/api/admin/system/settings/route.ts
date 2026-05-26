import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleAccess } from "@/lib/server/auth";
import { PLATFORM_SITE_SETTING_KEY } from "@/lib/server/site-settings";
import { getPrismaClient } from "@/lib/server/prisma";

const dataImagePattern = /^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,[A-Za-z0-9+/=\r\n]+$/;

function sanitizeOptionalText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeOptionalDataImage(value: string | null | undefined) {
  const cleaned = sanitizeOptionalText(value);

  if (!cleaned) {
    return null;
  }

  if (!dataImagePattern.test(cleaned)) {
    throw new Error("Image must be a valid base64 data URL in PNG/JPG/WEBP/SVG format.");
  }

  return cleaned;
}

function isValidWebsite(value: string | null) {
  if (!value) {
    return true;
  }

  try {
    const url = new URL(value);
    const isHttp = url.protocol === "http:" || url.protocol === "https:";
    const hostname = url.hostname.trim();
    const hasValidHost = hostname === "localhost" || hostname.includes(".");
    return isHttp && hasValidHost;
  } catch {
    return false;
  }
}

const updateSchema = z.object({
  siteName: z.string().trim().min(1).max(120),
  siteNameEn: z.string().trim().max(120).optional().nullable(),
  shortName: z.string().trim().max(80).optional().nullable(),
  tagline: z.string().trim().max(240).optional().nullable(),
  taglineEn: z.string().trim().max(240).optional().nullable(),
  logoColor: z.string().trim().max(1000000).optional().nullable(),
  logoMono: z.string().trim().max(1000000).optional().nullable(),
  favicon: z.string().trim().max(1000000).optional().nullable(),
  supportEmail: z.string().trim().email().max(160).optional().nullable(),
  supportPhone: z.string().trim().max(80).optional().nullable(),
  supportWebsite: z.string().trim().max(240).optional().nullable(),
  copyrightText: z.string().trim().max(400).optional().nullable(),
  copyrightTextEn: z.string().trim().max(400).optional().nullable(),
  icpNumber: z.string().trim().max(120).optional().nullable(),
  themeColor: z.string().trim().max(32).optional().nullable(),
  themeColorDark: z.string().trim().max(32).optional().nullable(),
});

export async function GET() {
  await requireRoleAccess("en", ["ADMIN"], "/en/admin/system");
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const settings = await prisma.siteSetting.findUnique({
    where: { key: PLATFORM_SITE_SETTING_KEY },
  });

  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  const user = await requireRoleAccess("en", ["ADMIN"], "/en/admin/system");
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const payload = updateSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const supportWebsite = sanitizeOptionalText(payload.data.supportWebsite);

  if (!isValidWebsite(supportWebsite)) {
    return NextResponse.json(
      { error: "Support website must be a valid HTTP/HTTPS URL." },
      { status: 400 },
    );
  }

  let logoColor: string | null;
  let logoMono: string | null;
  let favicon: string | null;

  try {
    logoColor = sanitizeOptionalDataImage(payload.data.logoColor);
    logoMono = sanitizeOptionalDataImage(payload.data.logoMono);
    favicon = sanitizeOptionalDataImage(payload.data.favicon);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid image payload." },
      { status: 400 },
    );
  }

  const settings = await prisma.siteSetting.upsert({
    where: { key: PLATFORM_SITE_SETTING_KEY },
    create: {
      key: PLATFORM_SITE_SETTING_KEY,
      siteName: payload.data.siteName.trim(),
      siteNameEn: sanitizeOptionalText(payload.data.siteNameEn),
      shortName: sanitizeOptionalText(payload.data.shortName),
      tagline: sanitizeOptionalText(payload.data.tagline),
      taglineEn: sanitizeOptionalText(payload.data.taglineEn),
      logoColor,
      logoMono,
      favicon,
      supportEmail: sanitizeOptionalText(payload.data.supportEmail),
      supportPhone: sanitizeOptionalText(payload.data.supportPhone),
      supportWebsite,
      copyrightText: sanitizeOptionalText(payload.data.copyrightText),
      copyrightTextEn: sanitizeOptionalText(payload.data.copyrightTextEn),
      icpNumber: sanitizeOptionalText(payload.data.icpNumber),
      themeColor: sanitizeOptionalText(payload.data.themeColor),
      themeColorDark: sanitizeOptionalText(payload.data.themeColorDark),
      updatedByUserId: user.id,
    },
    update: {
      siteName: payload.data.siteName.trim(),
      siteNameEn: sanitizeOptionalText(payload.data.siteNameEn),
      shortName: sanitizeOptionalText(payload.data.shortName),
      tagline: sanitizeOptionalText(payload.data.tagline),
      taglineEn: sanitizeOptionalText(payload.data.taglineEn),
      logoColor,
      logoMono,
      favicon,
      supportEmail: sanitizeOptionalText(payload.data.supportEmail),
      supportPhone: sanitizeOptionalText(payload.data.supportPhone),
      supportWebsite,
      copyrightText: sanitizeOptionalText(payload.data.copyrightText),
      copyrightTextEn: sanitizeOptionalText(payload.data.copyrightTextEn),
      icpNumber: sanitizeOptionalText(payload.data.icpNumber),
      themeColor: sanitizeOptionalText(payload.data.themeColor),
      themeColorDark: sanitizeOptionalText(payload.data.themeColorDark),
      updatedByUserId: user.id,
    },
  });

  return NextResponse.json({ ok: true, settings });
}
