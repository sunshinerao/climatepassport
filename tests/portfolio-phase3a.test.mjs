import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Phase 3A migration is additive, seeds immutable dimensions and exactly one initial active ruleset", () => {
  const sql = read("prisma/migrations/20260913060000_portfolio_phase3a/migration.sql");
  assert.equal(/DROP\s+/i.test(sql), false);
  for (const key of ["LEARNING", "ACTION", "INNOVATION", "ORGANIZATION", "INFLUENCE"]) assert.match(sql, new RegExp(`'${key}'`));
  assert.match(sql, /portfolio_rule_sets_one_active/); assert.match(sql, /INSERT INTO "portfolio_rule_sets"/);
});
test("derivation is request-time, verified-only, five-dimensional, explainable and deduplicated", () => {
  const source = read("apps/passport-web/lib/server/portfolio.ts");
  assert.match(source, /status: "ISSUED"/); assert.match(source, /verificationLevel: "PLATFORM_VERIFIED"/);
  assert.match(source, /status: "COMPLETED"/); assert.match(source, /status: "VALID"/);
  assert.match(source, /new Map<string/); assert.match(source, /ruleVersion/); assert.match(source, /explanation/);
  assert.doesNotMatch(source, /\bscore\b|0-100|AI inferred/i);
});
test("consent and links enforce owner scope, policy, hash-only storage and audit", () => {
  const consent = read("apps/passport-web/app/api/me/portfolio/consent/route.ts"); const links = read("apps/passport-web/app/api/me/portfolio/share-links/route.ts");
  assert.match(consent, /normalizePortfolioFields/); assert.match(consent, /PORTFOLIO_POLICY_VERSION/); assert.match(consent, /PORTFOLIO_CONSENT_UPDATED/);
  assert.match(links, /tokenHash/); assert.match(links, /PORTFOLIO_SHARE_LINK_GRANTED/); assert.match(links, /userId: user.id/);
});
test("public projection uses the shared atomic resolver and excludes private identifiers", () => {
  const api = read("apps/passport-web/app/api/public/portfolio/[token]/route.ts"); const page = read("apps/passport-web/app/[locale]/portfolio/[token]/page.tsx"); const resolver = read("apps/passport-web/lib/server/portfolio.ts");
  assert.match(api, /resolvePublicPortfolioShare/); assert.match(page, /resolvePublicPortfolioShare/); assert.match(resolver, /UPDATE "portfolio_share_links"/); assert.match(api, /X-Robots-Tag/);
  assert.doesNotMatch(api + page, /climatePassportId|email|userId|uuid/i);
});
test("legacy profile lookup is disabled and dashboard UI remains localized and score-free", () => {
  assert.match(read("apps/passport-web/app/profile/[userId]/credentials/page.tsx"), /notFound\(\)/);
  const ui = read("apps/passport-web/components/portfolio-sharing-settings.tsx") + read("apps/passport-web/app/[locale]/dashboard/portfolio/page.tsx");
  assert.match(ui, /分享/); assert.match(ui, /Sharing/); assert.match(ui, /Revoke/); assert.doesNotMatch(ui, /chart|0-100/i);
});
test("admin rules APIs have an ADMIN boundary and do not expose consent mutation", () => {
  const admin = read("apps/passport-web/app/api/admin/portfolio/rules/route.ts");
  assert.match(admin, /user\.role === "ADMIN"/); assert.doesNotMatch(admin, /portfolioShareConsent/);
});
