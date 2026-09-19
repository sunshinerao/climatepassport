import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const sql = read("prisma/migrations/20260913080000_project_application_consent_phase3/migration.sql");
const schema = read("prisma/schema.prisma");
const service = read("apps/passport-web/lib/server/project-application.ts");
const submit = read("apps/passport-web/app/api/activity-applications/route.ts");
const detail = read("apps/passport-web/app/api/activity-applications/[id]/route.ts");
const review = read("apps/passport-web/app/api/activity-applications/[id]/review/route.ts");
const list = read("apps/passport-web/app/api/activities/[id]/applications/route.ts");
const batch = read("apps/passport-web/app/api/activity-applications/batch-review/route.ts");

test("PROJECT consent migration and schema are additive with one-to-one consent and private defaults", () => {
  assert.match(sql, /ADD COLUMN "applicantListVisibleToApplicants" BOOLEAN NOT NULL DEFAULT false/);
  assert.match(sql, /ADD COLUMN "allowInterestWithoutApplication" BOOLEAN NOT NULL DEFAULT false/);
  assert.match(sql, /CREATE TABLE "project_application_consents"/);
  assert.match(sql, /CREATE UNIQUE INDEX .*activityApplicationId_key/);
  assert.match(sql, /FOREIGN KEY \("activityApplicationId"\).*activity_applications.*ON DELETE CASCADE/s);
  assert.doesNotMatch(sql.replace(/^--.*$/gm, ""), /\b(DROP|RENAME|TRUNCATE)\b/i);
  assert.match(schema, /projectConsent\s+ProjectApplicationConsent\?/);
  assert.match(schema, /activityApplicationId\s+String\s+@unique/);
  assert.match(schema, /portfolioShareLinkId\s+String\?/);
});

test("PROJECT-only submission requires authenticated ownership, the current consent policy, scope, and active owned share links", () => {
  assert.match(submit, /activity\.type === "PROJECT" && status === "SUBMITTED"/);
  assert.match(submit, /currentUser\.id !== userId/);
  assert.match(submit, /isValidProjectConsentInput\(consent\)/);
  assert.match(submit, /At least one disclosure field must be consented/);
  assert.match(submit, /sharePortfolioLink && !consent\.portfolioShareLinkId/);
  assert.match(submit, /validateProjectPortfolioShareLink\(userId, consent\.portfolioShareLinkId\)/);
  assert.match(service, /c\.policyVersion !== PROJECT_APPLICATION_CONSENT_POLICY_VERSION/);
  assert.match(service, /link\.userId !== userId/);
  assert.match(service, /link\.status !== "ACTIVE"/);
  assert.match(service, /link\.expiresAt <= new Date\(\)/);
});

test("PROJECT review is owner/admin only and excludes recruitment transitions", () => {
  assert.match(service, /user\.role === "ADMIN"/);
  assert.match(service, /activity\.organizerUserId === user\.id/);
  assert.match(service, /return false/);
  assert.match(service, /return \["APPROVED", "REJECTED", "WAITLISTED"\]/);
  assert.doesNotMatch(service.match(/return \["APPROVED", "REJECTED", "WAITLISTED"\]/)?.[0] ?? "", /INTERVIEW|OFFERED/);
  assert.match(review, /canReviewProjectApplication\(currentUser, existing\.activity\)/);
  assert.match(review, /allowedProjectReviewStatuses\(\)\.includes\(status\)/);
  assert.match(batch, /canReviewProjectApplication\(currentUser, app\.activity\)/);
  assert.match(detail, /Only the applicant can withdraw a project application/);
});

test("PROJECT approval participation is idempotent and operations audit with safe notification sources", () => {
  for (const source of [review, batch]) {
    assert.match(source, /activityId_userId: \{ activityId:/);
    assert.match(source, /if \(!participationExists\)/);
  }
  assert.match(submit, /PROJECT_APPLICATION_SUBMITTED/);
  assert.match(submit, /PROJECT_APPLICATION_CONSENT_RECORDED/);
  assert.match(detail, /PROJECT_APPLICATION_WITHDRAWN/);
  assert.match(review, /PROJECT_APPLICATION_REVIEWED/);
  assert.match(list, /PROJECT_APPLICATIONS_VIEWED/);
  for (const source of [submit, detail, review, batch]) {
    assert.match(source, /channel: "IN_APP"/);
    assert.match(source, /source: "PROJECT_APPLICATION_/);
    assert.doesNotMatch(source, /body:\s*[^\n]*(email|climatePassportId|userId)/i);
  }
});

test("PROJECT review responses are field-scoped and do not disclose raw applicant identifiers or tokens", () => {
  assert.match(service, /if \(consent\.shareName\) disclosure\.name/);
  assert.match(service, /if \(consent\.shareEmail\) disclosure\.email/);
  assert.match(service, /if \(consent\.shareTitle\) disclosure\.title/);
  assert.match(service, /if \(consent\.shareBio\) disclosure\.bio/);
  assert.match(service, /if \(consent\.shareAffiliations/);
  assert.match(service, /if \(consent\.sharePortfolioLink/);
  assert.match(service, /Expose only the link id; raw token is never disclosed/);
  assert.match(list, /userId: undefined/);
  assert.match(list, /buildProjectApplicantDisclosure/);
  assert.doesNotMatch(list, /climatePassportId:\s*app\.user\.climatePassportId/);
  assert.match(detail, /userId: undefined, applicant: disclosure/);
});

test("bounded PROJECT workflow adds no team applications, jobs, search, matching, AI, or public applicant directory", () => {
  const scoped = [service, submit, detail, review, list, batch].join("\n").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(scoped, /\b(recruitment|matching|candidate search|team application|jobs?|AI)\b/i);
  const apiFiles = ["apps/passport-web/app/api", "apps/passport-web/app/[locale]"];
  for (const directory of apiFiles) {
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
    for (const file of walk(path.join(root, directory)).filter((file) => /\.(ts|tsx)$/.test(file))) {
      assert.equal(/public.*applicant|applicant.*directory/i.test(fs.readFileSync(file, "utf8")), false, file);
    }
  }
});
