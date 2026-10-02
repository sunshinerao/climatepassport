import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

// 统一收口：窄屏溢出修在共享层，不给单个页面打补丁。这几个断言锁定共享层的形状，
// 避免有人把规则搬回 features/*.css 或重新写回 `1fr`（= minmax(auto,1fr)，会被
// 一个宽 <select> / 不可断行的 UUID / 一张宽表撑破）。

const webRoot = "apps/passport-web";
const shared = readFileSync(`${webRoot}/app/styles/shared/extended-components.css`, "utf8").replace(/\s+/g, " ");
const globals = readFileSync(`${webRoot}/app/globals.css`, "utf8").replace(/\s+/g, " ");
const certificateAdmin = readFileSync(`${webRoot}/app/styles/features/certificate-admin.css`, "utf8").replace(/\s+/g, " ");

function ruleBlock(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escaped} \\{([^}]*)\\}`));
  assert.ok(match, `expected a CSS rule for \`${selector}\``);
  return match[1];
}

test("admin shell tracks are minmax(0,1fr), never bare 1fr", () => {
  assert.match(shared, /\.proto-admin-shell \{ grid-template-columns: 280px minmax\(0, 1fr\); \}/);
  assert.doesNotMatch(shared, /\.proto-admin-shell \{ grid-template-columns: 280px 1fr; \}/);
  assert.match(ruleBlock(globals, ".split"), /repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(ruleBlock(shared, ".two-col"), /repeat\(2, minmax\(0, 1fr\)\)/);
});

test("the collapse media queries keep the 0 minimum", () => {
  const narrow = shared.slice(shared.indexOf("@media (max-width: 980px)"));
  assert.match(narrow, /\.proto-dashboard-shell, \.proto-admin-shell \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(narrow, /\.hero, \.passport-layout, \.split, \.auth-grid, \.table-row, \.two-col \{ grid-template-columns: minmax\(0, 1fr\); \}/);
});

test("shared layout items are pinned to min-width: 0", () => {
  const block = shared.match(/\.proto-admin-main,\s*\.proto-admin-page,[\s\S]*?\{([^}]*)\}/);
  assert.ok(block, "expected the shared min-width: 0 selector group");
  const group = block[0];
  for (const selector of [".proto-admin-main", ".section", ".panel", ".list", ".tableish", ".form-grid", ".field", ".split"]) {
    assert.ok(group.includes(selector), `expected ${selector} in the min-width: 0 group`);
  }
  assert.equal(block[1].trim(), "min-width: 0;");
});

test("form controls and scroll wrappers cannot set a page width", () => {
  assert.match(shared, /input:not\(\[type="checkbox"\]\)[^{]*select,\s*textarea \{ min-width: 0; max-width: 100%; \}/);
  assert.match(ruleBlock(shared, ".table-scroll"), /overflow-x: auto/);
  assert.match(shared, /\.section-header \{ flex-wrap: wrap; \}/);
  // `.table-scroll` was used by three admin tables with no rule behind it.
  for (const component of ["admin-badge-awards-client.tsx", "admin-achievements-client.tsx", "admin-badge-definitions-client.tsx"]) {
    assert.match(readFileSync(`${webRoot}/components/${component}`, "utf8"), /table-scroll/);
  }
  assert.match(shared, /overflow-wrap: anywhere/);
  assert.match(certificateAdmin, /\.cpca-filter-row > label \{[^}]*min-width: 0; \}/);
  assert.match(certificateAdmin, /\.cpca-filter-row \{[^}]*min-width: 0; overflow-x: auto; \}/);
});

test("the per-page narrow-screen stylesheet is gone, superseded by the shared layer", () => {
  assert.equal(existsSync(`${webRoot}/app/styles/features/admin-channel-clients.css`), false);
  assert.doesNotMatch(globals, /admin-channel-clients\.css/);
});
