/**
 * 源码级测试：CP 自有数据治理页面与 ui-flows 组件（CP-TODO-258 / CP-FR-072）
 *
 * 覆盖（文件级断言）：
 * - passport-ui-flows 包：三组件导出、无数据获取/项目专属流程（无 fetch/router 依赖）
 * - 三个页面：薄 server 页 + requireAuthenticatedUser 回跳（account-data/consents/records）
 * - 账户菜单含三页双语链接；Screen 双语文案；导出/撤回/删除按钮语义
 * - CSS：四屏宽断点（480/760/1024）、data-tone 主题钩子、危险区样式
 * - e2e spec：四视口数组、键盘菜单、回跳、下载与删除确认门
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");
const uiFlows = read("packages/passport-ui-flows/src/index.tsx");
const screens = read("apps/passport-web/components/data-governance-screens.tsx");
const css = read("apps/passport-web/app/styles/features/data-governance.css");
const menu = read("apps/passport-web/components/user-account-menu.tsx");
const e2e = read("tests/e2e/cp-data-governance.spec.ts");

test("passport-ui-flows exports the three reusable components without business logic", () => {
  for (const name of ["DataActionCard", "ConfirmDangerAction", "StatusPill"]) {
    assert.match(uiFlows, new RegExp(`export function ${name}`), `${name} exported`);
  }
  assert.doesNotMatch(uiFlows, /fetch\(|useRouter|next\/navigation|next\/link/, "组件不得内嵌数据获取或项目专属流程");
  assert.match(uiFlows, /data-tone/, "主题钩子 data-tone");
  assert.match(uiFlows, /useState/, "ConfirmDangerAction 键入确认交互");
  assert.match(uiFlows, /aria-disabled/, "危险按钮可访问性语义");
});

test("three CP-owned pages exist with auth-gated redirect-back", () => {
  for (const route of ["account-data", "consents", "records"]) {
    const page = read(`apps/passport-web/app/[locale]/dashboard/${route}/page.tsx`);
    assert.match(page, /requireAuthenticatedUser/, `${route} 页面要求登录`);
    assert.match(page, new RegExp(`dashboard/${route}`), `${route} 回跳路径`);
  }
});

test("account menu links the three pages bilingually", () => {
  for (const [href, zh, en] of [
    ["dashboard/records", "我的记录", "My Records"],
    ["dashboard/consents", "授权管理", "Consents"],
    ["dashboard/account-data", "数据与账户", "Data & Account"],
  ]) {
    assert.match(menu, new RegExp(href.replace(/\//g, "\\/")), `${href} linked`);
    assert.ok(menu.includes(zh) && menu.includes(en), `${href} bilingual`);
  }
});

test("screens carry bilingual copy and safe action semantics", () => {
  for (const phrase of ["数据与账户", "Data & Account", "导出我的数据", "删除账户", "授权管理", "我的记录", "My Records", "Consents"]) {
    assert.ok(screens.includes(phrase), `screen copy: ${phrase}`);
  }
  assert.match(screens, /\/api\/account\/export/, "导出走本人导出端点");
  assert.match(screens, /\/api\/account\/delete/, "删除走确认门端点");
  assert.match(screens, /confirm: true/, "删除请求显式确认");
  assert.match(screens, /retentionNotice/, "受限保留说明展示");
  assert.match(screens, /\/api\/consents\/\$\{id\}\/withdraw/, "同意撤回端点");
  assert.match(screens, /method: "DELETE"/, "记录撤回端点");
  assert.doesNotMatch(screens, /payloadJson: \{[^}]*\}\s*\/\/\s*展示/, "记录列表不渲染正文");
});

test("CSS covers four screen widths with theme hooks", () => {
  for (const bp of ["480", "760", "1024"]) {
    assert.match(css, new RegExp(`max-width: ${bp}px`), `breakpoint ${bp}`);
  }
  assert.match(css, /ui-flow-card--danger/, "危险面板样式");
  assert.match(css, /ui-flow-pill--(success|warning|danger)/, "状态徽标色调");
});

test("e2e spec exercises viewports, keyboard menu, redirect-back and confirmations", () => {
  assert.match(e2e, /width: 360[\s\S]*width: 1440/, "四视口（360→1440）");
  assert.match(e2e, /keyboard\.press\("Enter"\)/, "键盘展开移动菜单");
  assert.match(e2e, /waitForURL\(\/login/, "未登录回跳登录页");
  assert.match(e2e, /waitForEvent\("download"/, "导出下载事件");
  assert.match(e2e, /toBeDisabled\(\)[\s\S]*fill\("DELETE"\)/, "删除键入确认门");
  assert.match(e2e, /WITHDRAWN/, "撤回状态断言");
});
