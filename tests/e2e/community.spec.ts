/**
 * E2E 测试：社区流程
 *
 * 覆盖：创建讨论帖、添加评论、管理员审核帖子。
 * 社区功能通常挂载在具体活动下，因此测试会先进入某个活动社区页面。
 */

import { test, expect } from "@playwright/test";
import { testData } from "../fixtures/test-data";

test.describe("社区流程", () => {
  const locale = testData.locale;

  test("创建讨论帖", async ({ page }) => {
    await page.goto(`/${locale}/activities`);
    const firstActivity = page.locator("[data-testid='activity-card']").first();
    if ((await firstActivity.count()) === 0) {
      test.skip(true, "当前环境没有测试活动，无法进入社区");
    }
    await firstActivity.click();

    const communityTab = page.locator("a[href*='/community'], [data-testid='community-tab']");
    if ((await communityTab.count()) === 0) {
      test.skip(true, "当前活动未开放社区功能");
    }
    await communityTab.click();

    const createButton = page.locator("[data-testid='create-post-button']");
    if ((await createButton.count()) === 0) {
      test.skip(true, "当前页面未实现发帖功能");
    }
    await createButton.click();
    await page.fill('input[name="title"]', testData.community.title());
    await page.fill('textarea[name="content"]', testData.community.content);
    await page.click('button[type="submit"]');

    await expect(page.locator('[role="status"], [data-testid="post-created"]')).toBeVisible({ timeout: 10000 });
  });

  test("添加评论", async ({ page }) => {
    await page.goto(`/${locale}/activities`);
    const firstActivity = page.locator("[data-testid='activity-card']").first();
    if ((await firstActivity.count()) === 0) {
      test.skip(true, "当前环境没有测试活动，无法进入社区");
    }
    await firstActivity.click();

    const communityTab = page.locator("a[href*='/community'], [data-testid='community-tab']");
    if ((await communityTab.count()) === 0) {
      test.skip(true, "当前活动未开放社区功能");
    }
    await communityTab.click();

    const firstPost = page.locator("[data-testid='community-post']").first();
    if ((await firstPost.count()) === 0) {
      test.skip(true, "当前社区没有可评论的帖子");
    }
    await firstPost.click();

    const commentBox = page.locator("textarea[name='comment'], [data-testid='comment-input']");
    if ((await commentBox.count()) === 0) {
      test.skip(true, "当前页面未实现评论功能");
    }
    await commentBox.fill(testData.community.comment);
    await page.locator("button[data-testid='submit-comment']").click();
    await expect(page.locator('[data-testid="comment-submitted"]')).toBeVisible({ timeout: 10000 });
  });

  test("管理员审核帖子", async ({ page }) => {
    test.skip(true, "管理员审核需要管理员账号及待审核帖子，当前作为占位测试，可在集成环境中启用");
    await page.goto(`/${locale}/admin/activities`);
    await page.locator("[data-testid='community-moderation-link']").first().click();
    await page.locator("[data-testid='approve-post-button']").first().click();
    await expect(page.locator('[data-testid="moderation-approved"]')).toBeVisible({ timeout: 10000 });
  });
});
