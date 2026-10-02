/**
 * 统一收口：所有 ADMIN 页面在 360px 视口下不得横向溢出
 *
 * 这一条不针对单个页面打补丁——溢出来自共享布局层（`.two-col` / `.split` / `.panel` 里的
 * `<select>`、`<input>` 固有宽度撑破 `1fr` 轨道的 `auto` 最小尺寸）。所以这里遍历全站
 * ADMIN 页面，一次跑完把所有仍会溢出的页面一起报出来。
 *
 * 只覆盖不需要行主键的页面；`activities/[id]/**`、`certificates/templates/[id]` 这类
 * 详情/编辑页依赖运行时数据，由各自的 e2e 覆盖。
 * `learning-experiences/applications` 是一个 `redirect()` 占位页、没有自己的 UI，故不在清单内。
 */

import { expect, test, type Page } from "@playwright/test";
import { testData } from "../fixtures/test-data";

const baseURL = process.env.CP_TEST_BASE_URL;
if (!baseURL) throw new Error("CP_TEST_BASE_URL is required for e2e tests.");

const NARROW_VIEWPORT = { width: 360, height: 800 };

const ADMIN_PATHS = [
  "",
  "achievements",
  "activities",
  "activities-checkin",
  "activities/applications",
  "activities/certificates",
  "activities/checkin",
  "activities/form-templates",
  "activities/new",
  "activities/participations",
  "activities/reviews",
  "activities/rewards",
  "activities/submissions",
  "activities/tasks",
  "activity-organizers",
  "badges/awards",
  "badges/definitions",
  "certificates",
  "certificates/applications",
  "certificates/audit-logs",
  "certificates/categories",
  "certificates/issue",
  "certificates/records",
  "certificates/rules",
  "certificates/templates",
  "channel-clients",
  "events",
  "institutions",
  "learning-experiences",
  "messages",
  "people",
  "summer-school/applications",
  "system",
  "system/diagnostics",
];

type Measurement = {
  path: string;
  status: number;
  overflow: number;
  scrollWidth: number;
  widest: { tag: string; cls: string; right: number; width: number }[];
};

async function measure(page: Page, path: string): Promise<Measurement> {
  const url = `${baseURL}/en/admin${path ? `/${path}` : ""}`;
  const response = await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  const sample = await page.evaluate(() => {
    const doc = document.documentElement;
    const overflow = doc.scrollWidth - window.innerWidth;
    const widest =
      overflow > 1
        ? Array.from(document.querySelectorAll("body *"))
            .filter((el) => {
              // 横向滚动容器里的宽表格不算：它不撑大文档，只是自身可滑动。
              let cur: HTMLElement | null = el as HTMLElement;
              while (cur && cur !== document.body) {
                if (/(auto|scroll|hidden)/.test(getComputedStyle(cur).overflowX)) return false;
                cur = cur.parentElement;
              }
              return true;
            })
            .map((el) => {
              const box = el.getBoundingClientRect();
              return {
                tag: el.tagName.toLowerCase(),
                cls: typeof el.className === "string" ? el.className.slice(0, 60) : "",
                right: Math.round(box.right + window.scrollX),
                width: Math.round(box.width),
              };
            })
            .filter((entry) => entry.right > window.innerWidth)
            .sort((a, b) => b.right - a.right)
            .slice(0, 4)
        : [];
    return { overflow, scrollWidth: doc.scrollWidth, widest };
  });
  return { path: path || "(dashboard)", status: response?.status() ?? 0, ...sample };
}

test("全部 ADMIN 页面在 360px 下无横向溢出", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize(NARROW_VIEWPORT);
  const admin = testData.seededUsers.admin;
  const login = await page.request.post("/api/auth/login", {
    data: { locale: "en", email: admin.email, password: admin.password },
  });
  expect(login.status()).toBe(200);

  const offenders: Measurement[] = [];
  const redirected: string[] = [];
  for (const path of ADMIN_PATHS) {
    const result = await measure(page, path);
    // 被踢到别的页说明该页没渲染，不能算通过；但继续跑完，一次报全。
    if (new URL(page.url()).pathname !== `/en/admin${path ? `/${path}` : ""}`) {
      redirected.push(`${result.path} → ${new URL(page.url()).pathname}`);
      continue;
    }
    if (result.overflow > 1) offenders.push(result);
  }

  const problems = [
    ...offenders.map((o) => `溢出 ${o.path}: scrollWidth ${o.scrollWidth}px (+${o.overflow}) → ${o.widest.map((w) => `${w.tag}.${w.cls}@${w.width}px`).join(" | ")}`),
    ...redirected.map((entry) => `未渲染 ${entry}`),
  ];
  if (problems.length) {
    throw new Error(`${problems.length} 项（共 ${ADMIN_PATHS.length} 页，360px）：\n${problems.join("\n")}`);
  }
});
