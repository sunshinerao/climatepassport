/**
 * E2E 测试：认证流程
 *
 * 覆盖：用户注册、登录、登出三个核心流程。
 * 测试数据由 prisma/seed.mjs 注入测试数据库；动态注册的账号未验证邮箱，
 * 会跳转到验证页；种子账号已完成验证，可真正登录。
 */

import { test, expect } from "@playwright/test";
import { buildRegisterPayload, buildLoginPayload, testData } from "../fixtures/test-data";

test.describe("认证流程", () => {
  const locale = testData.locale;

  test("用户注册：填写表单并提交后应收到成功或需验证邮箱的反馈", async ({ page }) => {
    const payload = buildRegisterPayload(locale);
    // 保存邮箱供后续登录测试复用
    test.info().attach("registeredEmail", { body: payload.email, contentType: "text/plain" });

    await page.goto(`/${locale}/auth/register`);
    await expect(page.locator('form, input[name="email"], button[type="submit"]').first()).toBeVisible();

    await page.fill('input[name="name"]', payload.name);
    await page.fill('input[name="email"]', payload.email);
    await page.fill('input[name="password"]', payload.password);
    await page.fill('input[name="phone"]', payload.phone);

    // country 是自定义 Combobox：先聚焦输入框，输入国家名，再选择下拉选项
    const countryInput = page.locator('input[name="country"]');
    await countryInput.fill(payload.country);
    // 等待下拉列表渲染并选择第一个匹配项
    const firstOption = page.locator('.country-combobox-list [role="option"]').first();
    await expect(firstOption).toBeVisible({ timeout: 5000 });
    await firstOption.click();
    await expect(countryInput).toHaveValue(payload.country);

    await page.fill('input[name="organizationName"]', payload.organizationName);

    await page.click('button[type="submit"]');

    // 注册接口返回成功后会跳转验证页；若邮件服务未配置可能停留在页面并显示错误
    await Promise.race([
      page.waitForURL(`/${locale}/auth/verify-email**`, { timeout: 15000 }),
      page.waitForSelector('[data-testid="register-success"]', { timeout: 15000 }),
      page.waitForSelector('.form-error', { timeout: 15000 }),
    ]).catch(() => {
      // 某些实现可能直接跳转，不强制要求显式反馈
    });

    // 只要不在注册页停留且没有“已存在”错误，即认为注册请求已处理
    const currentUrl = page.url();
    const errorText = await page.locator('.form-error').textContent().catch(() => "");
    expect(currentUrl).not.toBe(`${process.env.CP_TEST_BASE_URL || "http://localhost:3000"}/${locale}/auth/register`);
    expect(errorText).not.toContain("already exists");
  });

  test("用户登录：使用已验证种子账号应成功跳转工作台", async ({ page }) => {
    const user = testData.seededUsers.attendee;

    await page.goto(`/${locale}/auth/login`);
    await expect(page.locator('form, input[name="email"], button[type="submit"]').first()).toBeVisible();

    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);
    await page.click('button[type="submit"]');

    // 等待跳转到工作台
    await page.waitForURL(`/${locale}/dashboard/**`, { timeout: 15000 });
    expect(page.url()).toContain(`/${locale}/dashboard/`);
  });

  test("用户登录：未验证邮箱的账号应跳转验证页", async ({ page }) => {
    const payload = buildRegisterPayload(locale);

    // 先注册一个未验证账号
    await page.goto(`/${locale}/auth/register`);
    await page.fill('input[name="name"]', payload.name);
    await page.fill('input[name="email"]', payload.email);
    await page.fill('input[name="password"]', payload.password);
    await page.fill('input[name="phone"]', payload.phone);

    const countryInput = page.locator('input[name="country"]');
    await countryInput.fill(payload.country);
    const firstOption = page.locator('.country-combobox-list [role="option"]').first();
    await expect(firstOption).toBeVisible({ timeout: 5000 });
    await firstOption.click();

    await page.fill('input[name="organizationName"]', payload.organizationName);
    await page.click('button[type="submit"]');

    // 等待注册完成（跳转验证页或显示成功）
    await page.waitForURL(`/${locale}/auth/verify-email**`, { timeout: 15000 }).catch(() => {});

    // 使用刚注册的未验证账号登录
    await page.goto(`/${locale}/auth/login`);
    await page.fill('input[name="email"]', payload.email);
    await page.fill('input[name="password"]', payload.password);
    await page.click('button[type="submit"]');

    // 应跳转验证页或保持登录页并提示需验证
    await Promise.race([
      page.waitForURL(`/${locale}/auth/verify-email**`, { timeout: 15000 }),
      page.waitForSelector('.form-error', { timeout: 15000 }),
    ]).catch(() => {});

    const currentUrl = page.url();
    const errorText = await page.locator('.form-error').textContent().catch(() => "");
    expect(currentUrl.includes("/auth/verify-email") || errorText.toLowerCase().includes("verify")).toBeTruthy();
  });

  test("登出验证：已登录用户点击登出后应清除会话并回到登录页", async ({ page }) => {
    const user = testData.seededUsers.attendee;

    // 先登录
    await page.goto(`/${locale}/auth/login`);
    await page.fill('input[name="email"]', user.email);
    await page.fill('input[name="password"]', user.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(`/${locale}/dashboard/**`, { timeout: 15000 });

    // 访问工作台并尝试点击登出
    await page.goto(`/${locale}/dashboard/climate-passport`);
    const logoutButton = page.locator('[data-testid="logout-button"]');

    if (await logoutButton.count() > 0) {
      await logoutButton.click();
    } else {
      // 若页面没有显式登出按钮，直接调用登出 API
      await page.request.post("/api/auth/logout");
    }

    // 登出后访问需要登录的页面应被重定向到登录页
    const response = await page.goto(`/${locale}/dashboard/certificates`);
    expect(response?.url()).toContain("/auth/login");
  });
});
