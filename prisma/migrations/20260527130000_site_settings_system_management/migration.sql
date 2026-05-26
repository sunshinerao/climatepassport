CREATE TABLE IF NOT EXISTS "site_settings" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "siteName" TEXT NOT NULL,
  "siteNameEn" TEXT,
  "shortName" TEXT,
  "tagline" TEXT,
  "taglineEn" TEXT,
  "logoColor" TEXT,
  "logoMono" TEXT,
  "favicon" TEXT,
  "supportEmail" TEXT,
  "supportPhone" TEXT,
  "supportWebsite" TEXT,
  "copyrightText" TEXT,
  "copyrightTextEn" TEXT,
  "icpNumber" TEXT,
  "themeColor" TEXT,
  "themeColorDark" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "site_settings_key_key" ON "site_settings"("key");

INSERT INTO "site_settings" (
  "id",
  "key",
  "siteName",
  "siteNameEn",
  "shortName",
  "tagline",
  "taglineEn",
  "supportEmail",
  "createdAt",
  "updatedAt"
)
VALUES (
  'site-setting-platform',
  'platform',
  'Climate Passport',
  'Climate Passport',
  'CP',
  '面向气候时代的可信数字身份基础设施',
  'Trusted digital identity infrastructure for the climate era.',
  'contact@climatepass.org',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
