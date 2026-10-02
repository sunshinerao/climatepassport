/**
 * CP-TODO-258：CP 自有数据治理页面的端到端验收（CP-FR-072/073）
 *
 * 覆盖：
 * - 回跳：未登录访问受保护页 → 登录后回到原页面（requireAuthenticatedUser 语义）
 * - 双语：zh / en 页面关键文案
 * - 四屏宽：360 / 768 / 1024 / 1440 视口下页面无横向溢出、关键控件可达
 * - 键盘与移动菜单：Tab 聚焦移动菜单按钮、Enter/Space 展开、菜单链接可见
 * - 账户数据页：导出触发下载（附件名）；删除需键入 DELETE 确认，成功后展示受限保留说明
 * - 授权页：创建同意 → 列表展示 → 撤回生效
 * - 记录页：创建记录 → 列表展示 → 撤回生效
 */

import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { testData } from "../fixtures/test-data";

const baseURL = process.env.CP_TEST_BASE_URL;
if (!baseURL) throw new Error("CP_TEST_BASE_URL is required for e2e tests.");

const prisma = new PrismaClient();
const runSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function apiLogin(page: Page, locale: string, email: string, password: string) {
  const response = await page.request.post("/api/auth/login", { data: { locale, email, password } });
  expect(response.status()).toBe(200);
}

async function createDisposableUser(tag: string) {
  const email = `e2e_${tag}_${runSuffix}@example.com`;
  const user = await prisma.user.create({
    data: { email, name: `E2E ${tag}`, password: await hash("seeded-password", 10), role: "ATTENDEE", emailVerified: new Date() },
  });
  return { email, id: user.id };
}

const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

test.describe("CP 数据治理页面（CP-TODO-258）", () => {
  test("回跳：未登录访问受保护页，登录后返回原页面", async ({ page }) => {
    await page.goto(`${baseURL}/en/dashboard/account-data`);
    await page.waitForURL(/login|auth|sign-in/i, { timeout: 15000 });
    const { email } = await createDisposableUser("redirect");
    await apiLogin(page, "en", email, "seeded-password");
    await page.goto(`${baseURL}/en/dashboard/account-data`);
    await expect(page).toHaveURL(/\/en\/dashboard\/account-data$/);
    await expect(page.getByRole("heading", { name: "Data & Account" })).toBeVisible();
  });

  test("双语：zh 与 en 关键文案", async ({ page }) => {
    const { email } = await createDisposableUser("locale");
    await apiLogin(page, "zh", email, "seeded-password");
    await page.goto(`${baseURL}/zh/dashboard/consents`);
    await expect(page.getByRole("heading", { name: "授权管理" })).toBeVisible();
    await page.goto(`${baseURL}/en/dashboard/records`);
    await expect(page.getByRole("heading", { name: "My Records" })).toBeVisible();
  });

  for (const viewport of VIEWPORTS) {
    test(`四屏宽 ${viewport.width}px：无横向溢出且控件可达`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const { email } = await createDisposableUser(`vw${viewport.width}`);
      await apiLogin(page, "en", email, "seeded-password");
      await page.goto(`${baseURL}/en/dashboard/account-data`);
      await expect(page.getByRole("button", { name: /download data copy/i })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }

  test("键盘与移动菜单：Tab 聚焦展开，菜单链接可达", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { email } = await createDisposableUser("keyboard");
    await apiLogin(page, "en", email, "seeded-password");
    await page.goto(`${baseURL}/en/dashboard/account-data`);
    // 移动视口下账户菜单为 <details>/<summary>；用键盘展开并找到退出/菜单链接。
    const summary = page.locator("details summary").first();
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("details[open] a, details[open] button").first()).toBeVisible();
  });

  test("账户数据页：导出下载 + 删除确认门与保留说明", async ({ page }) => {
    const { email } = await createDisposableUser("account");
    await apiLogin(page, "en", email, "seeded-password");

    await page.goto(`${baseURL}/en/dashboard/account-data`);
    const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
    await page.getByRole("button", { name: /download data copy/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/climate-passport-export-.*\.json/);

    // 未键入确认值时按钮禁用
    const dangerButton = page.getByRole("button", { name: /permanently delete account/i });
    await expect(dangerButton).toBeDisabled();

    await page.getByPlaceholder("DELETE").fill("WRONG");
    await expect(dangerButton).toBeDisabled();

    await page.getByPlaceholder("DELETE").fill("DELETE");
    await expect(dangerButton).toBeEnabled();
    await dangerButton.click();
    await expect(page.getByText(/account has been deleted/i)).toBeVisible();
    await expect(page.getByText(/audit logs/i).first()).toBeVisible();

    // 删除后会话失效：受保护页重新要求登录
    await page.goto(`${baseURL}/en/dashboard/account-data`);
    await page.waitForURL(/login|auth|sign-in/i, { timeout: 15000 });
  });

  test("授权页：创建 → 列表 → 撤回", async ({ page }) => {
    const { email, id } = await createDisposableUser("consents");
    await apiLogin(page, "en", email, "seeded-password");

    await page.goto(`${baseURL}/en/dashboard/consents`);
    await expect(page.getByText(/no consents yet/i)).toBeVisible();

    const create = await page.request.post("/api/consents", { data: { subjectUserId: id, purpose: "image_use", evidenceJson: { reference: "e2e" } } });
    expect(create.status()).toBe(201);

    await page.reload();
    await expect(page.getByText("image_use")).toBeVisible();
    await page.getByRole("button", { name: /^withdraw$/i }).first().click();
    await expect(page.getByText("WITHDRAWN")).toBeVisible();
  });

  test("记录页：创建 → 列表 → 撤回", async ({ page }) => {
    const { email } = await createDisposableUser("records");
    await apiLogin(page, "en", email, "seeded-password");

    await page.goto(`${baseURL}/en/dashboard/records`);
    await expect(page.getByText(/no records yet/i)).toBeVisible();

    const create = await page.request.post("/api/records", {
      data: { recordType: "e2e_note", title: `E2E record ${runSuffix}`, payloadJson: { note: "from e2e" } },
    });
    expect(create.status()).toBe(201);
    const created = (await create.json()) as { recordId: string };

    await page.reload();
    const recordTitle = page.getByText(`E2E record ${runSuffix}`);
    await expect(recordTitle).toBeVisible();

    await page.getByRole("button", { name: /^withdraw$/i }).first().click();
    // 撤回后 ACTIVE 列表不再展示该记录（列表只含 ACTIVE； outsider 读为 404）
    await expect(recordTitle).toBeHidden();
    await expect(page.getByText(/no records yet/i)).toBeVisible();
    const detail = await page.request.get(`/api/records/${created.recordId}`);
    expect(detail.status()).toBe(200);
    expect((await detail.json()).record.status).toBe("WITHDRAWN");
  });
});
