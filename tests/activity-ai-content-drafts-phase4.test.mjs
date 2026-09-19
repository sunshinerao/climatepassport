import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Phase 4 AI drafts are additive, reviewed, and have local retention purge", () => {
  const schema = read("prisma/schema.prisma"); const migration = read("prisma/migrations/20260913120000_activity_ai_content_drafts/migration.sql");
  assert.match(schema, /model ActivityAiContentDraft/); assert.match(schema, /REQUESTED[\s\S]*PUBLISHED[\s\S]*DELETED/);
  assert.doesNotMatch(migration, /DROP\s|DELETE\s+FROM/i);
  assert.match(read("scripts/purge-activity-ai-content-drafts.mjs"), /--apply/);
});
test("draft source and provider are bounded, allowlisted and fail closed", () => {
  const source = read("apps/passport-web/lib/server/activity-ai-content.ts");
  assert.match(source, /title.*subtitle.*summary.*description/s);
  assert.doesNotMatch(source, /activity\.(agenda|speaker|applicant|participation|certificate|portfolio)/i);
  assert.match(source, /AI_CONTENT_ASSIST_ENABLED !== "true"/); assert.match(source, /AI_CONTENT_ASSIST_PROVIDER !== "openai"/);
  assert.doesNotMatch(source, /attempt|retry/i);
});
test("generation is only draft scoped and publication requires approval with locale highlights", () => {
  const create = read("apps/passport-web/app/api/admin/activities/[id]/ai-content-drafts/route.ts"); const lifecycle = read("apps/passport-web/app/api/admin/activities/[id]/ai-content-drafts/[draftId]/route.ts");
  assert.match(create, /role === "ADMIN"/); assert.doesNotMatch(create, /activity\.update/);
  assert.match(lifecycle, /draft\.status !== "APPROVED"/); assert.match(lifecycle, /highlightsEn/); assert.match(lifecycle, /highlights: output\.items/);
});
test("legacy automatic/direct overwrite paths are absent", () => {
  assert.equal(fs.existsSync(path.join(root, "apps/passport-web/app/api/activities/[id]/generate-highlights/route.ts")), false);
  assert.equal(fs.existsSync(path.join(root, "apps/passport-web/lib/server/activity-highlights.ts")), false);
  assert.doesNotMatch(read("apps/passport-web/app/api/activities/route.ts"), /GenerateHighlights|generateHighlights/);
  assert.doesNotMatch(read("apps/passport-web/app/api/activities/[id]/route.ts"), /GenerateHighlights|generateHighlights/);
});
