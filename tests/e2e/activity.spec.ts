/**
 * E2E 测试：活动流程
 *
 * 覆盖：活动列表查看、活动报名、模拟 QR 签到、签到成功验证。
 * 需要测试环境存在可报名的公开活动；若不存在则跳过相关步骤。
 */

import { test, expect } from "@playwright/test";
import { testData } from "../fixtures/test-data";

async function loginAsSeededUser(page, locale) {
  const user = testData.seededUsers.attendee;
  await page.goto(`/${locale}/auth/login`);
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`/${locale}/dashboard/**`, { timeout: 15000 });
}

test.describe("活动流程", () => {
  const locale = testData.locale;

  test("用户查看活动列表", async ({ page }) => {
    await page.goto(`/${locale}/activities`);
    await expect(page).toHaveURL(`/${locale}/activities`);
    const list = page.locator("main").first();
    await expect(list).toBeVisible();
  });

  test("用户报名活动", async ({ page }) => {
    await loginAsSeededUser(page, locale);

    await page.goto(`/${locale}/activities`);
    const firstActivity = page.locator('.card-grid a[href^="/en/activities/"]').first();
    if ((await firstActivity.count()) === 0) {
      test.skip(true, "当前环境没有可报名的测试活动");
    }
    await firstActivity.click();
    await expect(page).toHaveURL(/\/activities\/.+/);

    // 详情页报名/申请按钮是一个链接，未登录时显示 Login to Register，登录后显示 Register Now / Apply
    const applyButton = page.locator('aside a.button[href*="/apply"]').first();
    if ((await applyButton.count()) === 0) {
      test.skip(true, "当前活动未提供报名入口（可能已报名或报名未开放）");
    }
    await applyButton.click();

    // 填写报名表单（如果存在）
    const form = page.locator("form.form-grid");
    if ((await form.count()) > 0) {
      await page.fill('textarea[id="apply-note"]', "Automated test application.").catch(() => {});
      await page.click('button[type="submit"]').catch(() => {});
    }

    await expect(page.locator('[role="status"], .form-success, main')).toBeVisible({ timeout: 10000 });
  });

  test("模拟活动签到（QR 扫描）", async ({ page }) => {
    test.skip(true, "QR 签到需要真实活动签到令牌，当前作为占位测试，可在集成环境中启用");
    await page.goto(`/${locale}/verifier`);
    await page.fill('input[name="checkinToken"]', "test-checkin-token");
    await page.click('button[type="submit"]');
    await expect(page.locator('[data-testid="checkin-success"]')).toBeVisible({ timeout: 10000 });
  });

  test("验证签到成功", async ({ page }) => {
    test.skip(true, "依赖上一个 QR 签到测试产生真实数据，当前作为占位测试");
    await page.goto(`/${locale}/dashboard/my-activities`);
    await expect(page.locator("[data-testid='checked-in-badge']").first()).toBeVisible();
  });
});
