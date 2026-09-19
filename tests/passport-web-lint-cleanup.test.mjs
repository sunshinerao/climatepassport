import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const webRoot = resolve(root, "apps/passport-web");

function read(relPath) {
  return readFileSync(resolve(webRoot, relPath), "utf8");
}

const NO_IMG_RULE = "@next/next/no-img-element";
const EXHAUSTIVE_RULE = "react-hooks/exhaustive-deps";
const NEXT_LINE_DISABLE = /eslint-disable-next-line\s+/g;

function hasNextLineDisable(source, rule) {
  return new RegExp(`eslint-disable-next-line\\s+${rule.replace(/\//g, "\\/")}`).test(source);
}

function assertNoBroadDisables(source, fileLabel) {
  const broad = source.match(/eslint-disable(?!-next-line)/g);
  const allowed = source.match(/eslint-disable-next-line/g) || [];
  assert.deepEqual(
    broad,
    null,
    `${fileLabel} must not contain broad eslint-disable comments (only targeted next-line disables)`,
  );
  assert.ok(
    allowed.every((_, i) => source.includes("eslint-disable-next-line")),
    `${fileLabel}: only eslint-disable-next-line is allowed`,
  );
}

describe("passport-web lint cleanup regressions", () => {
  describe("no-img-element handling", () => {
    it("retains dynamic/print/data-URL images with targeted suppressions", () => {
      const detail = read("app/[locale]/activities/[slug]/page.tsx");
      const poster = read("app/[locale]/activities/[slug]/poster/page.tsx");
      const list = read("app/[locale]/activities/page.tsx");
      const checkin = read("components/checkin-poster-client.tsx");

      assert.ok(hasNextLineDisable(detail, NO_IMG_RULE), "activity detail has no-img suppression");
      assert.ok(hasNextLineDisable(poster, NO_IMG_RULE), "poster page has no-img suppression");
      assert.ok(hasNextLineDisable(list, NO_IMG_RULE), "activity list has no-img suppression");
      assert.ok(hasNextLineDisable(checkin, NO_IMG_RULE), "checkin poster has no-img suppression");

      // At least the six retained images should each have a preceding next-line disable.
      const retainedImgCount =
        (detail.match(/<img\b/g) || []).length +
        (poster.match(/<img\b/g) || []).length +
        (list.match(/<img\b/g) || []).length +
        (checkin.match(/<img\b/g) || []).length;
      const disableCount =
        (detail.match(NEXT_LINE_DISABLE) || []).length +
        (poster.match(NEXT_LINE_DISABLE) || []).length +
        (list.match(NEXT_LINE_DISABLE) || []).length +
        (checkin.match(NEXT_LINE_DISABLE) || []).length;
      assert.ok(
        disableCount >= retainedImgCount,
        `every retained <img> should have a preceding eslint-disable-next-line (retained=${retainedImgCount}, disables=${disableCount})`,
      );
    });

    it("migrates fixed-size safe images to next/image", () => {
      const detail = read("app/[locale]/activities/[slug]/page.tsx");
      const list = read("app/[locale]/activities/page.tsx");
      const adminSpeakers = read("components/admin-activity-speakers-client.tsx");
      const eventDetail = read("components/event-detail-sections.tsx");

      assert.ok(detail.includes("<Image"), "activity detail speaker avatar uses Image");
      assert.ok(list.includes("<Image"), "activity list pinned thumbnail uses Image");
      assert.ok(adminSpeakers.includes("<Image"), "admin speaker avatar uses Image");
      assert.ok(eventDetail.includes("<Image"), "event detail speaker avatar uses Image");

      // They should be unoptimized to stay safe for arbitrary/external URLs.
      for (const [label, src] of [
        ["activity detail", detail],
        ["activity list", list],
        ["admin speakers", adminSpeakers],
        ["event detail", eventDetail],
      ]) {
        assert.ok(
          /unoptimized\b/.test(src),
          `${label} migrated Image should have unoptimized prop`,
        );
      }
    });

    it("does not use broad eslint-disable for image warnings", () => {
      const sources = [
        "app/[locale]/activities/[slug]/page.tsx",
        "app/[locale]/activities/[slug]/poster/page.tsx",
        "app/[locale]/activities/page.tsx",
        "components/admin-activity-speakers-client.tsx",
        "components/checkin-poster-client.tsx",
        "components/event-detail-sections.tsx",
      ];
      for (const path of sources) {
        assertNoBroadDisables(read(path), path);
      }
    });
  });

  describe("react-hooks/exhaustive-deps handling", () => {
    it("stabilizes t helper and includes it in useMemo deps", () => {
      const source = read("components/admin-activity-form-client.tsx");
      assert.ok(
        source.includes("const t = useCallback"),
        "t helper is wrapped in useCallback",
      );
      assert.ok(
        /},\s*\[[\s\S]*?\bt\b[\s\S]*?\]\);/.test(source),
        "useMemo dependency array includes t",
      );
    });

    it("stabilizes refreshTemplatePreview with useCallback and uses it in effect deps", () => {
      const source = read("components/admin-certificate-config-forms.tsx");
      assert.ok(
        source.includes("const refreshTemplatePreview = useCallback"),
        "refreshTemplatePreview is wrapped in useCallback",
      );
      assert.ok(
        /useEffect\([\s\S]*?refreshTemplatePreview[\s\S]*?\},\s*\[[\s\S]*?refreshTemplatePreview[\s\S]*?\]\);/.test(source),
        "preview effect depends on refreshTemplatePreview",
      );
    });

    it("documents deliberate reset-on-template-id effects with targeted suppression", () => {
      const configSource = read("components/admin-certificate-config-forms.tsx");
      const prototypeSource = read("components/certificate-admin-prototype.tsx");

      for (const [label, source] of [
        ["admin-certificate-config-forms", configSource],
        ["certificate-admin-prototype", prototypeSource],
      ]) {
        assert.ok(
          hasNextLineDisable(source, EXHAUSTIVE_RULE),
          `${label} has targeted react-hooks/exhaustive-deps suppression`,
        );
        assertNoBroadDisables(source, label);
      }

      // The suppression should sit right before a dependency array keyed on template id.
      assert.ok(
        /\/\/\s*eslint-disable-next-line react-hooks\/exhaustive-deps[\s\S]*?\[initialTemplate\?\.id\]/.test(configSource),
        "config reset effect suppression precedes [initialTemplate?.id]",
      );
      assert.ok(
        /\/\/\s*eslint-disable-next-line react-hooks\/exhaustive-deps[\s\S]*?\[selectedTemplate\?\.id\]/.test(prototypeSource),
        "prototype reset effect suppression precedes [selectedTemplate?.id]",
      );
    });
  });
});
