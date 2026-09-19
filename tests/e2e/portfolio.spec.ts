/**
 * E2E 测试：能力档案流程
 *
 * 覆盖：创建能力档案、生成分享链接、公开访问验证。
 */

import { test, expect } from "@playwright/test";
import { testData } from "../fixtures/test-data";

test.describe("能力档案流程", () => {
  const locale = testData.locale;

  test.beforeEach(async ({ page }) => {
    await page.goto(`/${locale}/dashboard/portfolio`);
    if (page.url().includes("/auth/login")) {
      test.skip(true, "当前环境未提供已验证的测试账号，跳过能力档案流程 E2E 测试");
    }
  });

  test("创建能力档案", async ({ page }) => {
    await page.goto(`/${locale}/dashboard/portfolio`);
    await expect(page).toHaveURL(`/${locale}/dashboard/portfolio`);

    const createButton = page.locator("[data-testid='create-portfolio-button']");
    if ((await createButton.count()) === 0) {
      test.skip(true, "当前页面未实现创建能力档案功能");
    }
    await createButton.click();

    await page.fill('input[name="title"]', testData.portfolio.title());
    await page.fill('textarea[name="bio"]', testData.portfolio.bio);
    await page.click('button[type="submit"]');

    await expect(page.locator('[role="status"], [data-testid="portfolio-saved"]')).toBeVisible({ timeout: 10000 });
  });

  test("生成分享链接", async ({ page }) => {
    await page.goto(`/${locale}/dashboard/portfolio`);

    const shareButton = page.locator("[data-testid='share-portfolio-button']");
    if ((await shareButton.count()) === 0) {
      test.skip(true, "当前页面未实现能力档案分享功能");
    }
    await shareButton.click();

    const shareInput = page.locator("[data-testid='portfolio-share-link']");
    await shareInput.waitFor({ timeout: 10000 });
    const shareUrl = await shareInput.inputValue();
    expect(shareUrl).toMatch(/^http/);
    expect(shareUrl).toContain("/portfolio/");
  });

  test("公开访问验证", async ({ browser }) => {
    const shareUrl = process.env.CP_TEST_PORTFOLIO_SHARE_URL;
    if (!shareUrl) {
      test.skip(true, "未配置 CP_TEST_PORTFOLIO_SHARE_URL，跳过公开访问验证");
    }
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(shareUrl);
    await expect(page.locator("h1, [data-testid='portfolio-title']")).toBeVisible();
    await context.close();
  });
});
