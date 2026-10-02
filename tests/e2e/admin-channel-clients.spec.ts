/**
 * CP-TODO-260：ADMIN「渠道客户端与密钥」页的浏览器验收（CP-FR-069，走的仍是 243 的四个管理路由）
 *
 * 覆盖：
 * - 门禁：ADMIN 可进入；EVENT_MANAGER 进不去
 * - 金路（一条完整生命周期）：登记 → 一次性明文 → 该明文可直接打 `/api/v1/open/whoami`
 *   → 改策略 → 轮换（应用内弹窗要原因，旧 key 当场 401、新 key 200）→ 撤销（401 + 原因落库 + 只读）
 * - 机密只出现一次：列表接口拿不到任何 secret 材料
 * - 清单分页：搜索交给服务端，翻页不重复、不丢行
 * - 四屏宽 360 / 768 / 1024 / 1440 无横向溢出
 */

import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { testData } from "../fixtures/test-data";

const baseURL = process.env.CP_TEST_BASE_URL;
if (!baseURL) throw new Error("CP_TEST_BASE_URL is required for e2e tests.");

const prisma = new PrismaClient();
const runSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const createdProgrammeIds: string[] = [];
const createdTenantIds: string[] = [];

async function loginAs(page: Page, role: "admin" | "eventManager") {
  const user = testData.seededUsers[role];
  const response = await page.request.post("/api/auth/login", {
    data: { locale: "en", email: user.email, password: user.password },
  });
  expect(response.status()).toBe(200);
}

async function createProgramme(tag: string) {
  const tenant = await prisma.tenant.create({
    data: { key: `e2e-cc-t-${tag}-${runSuffix}`, name: `E2E channel tenant ${tag} ${runSuffix}` },
    select: { id: true },
  });
  const name = `E2E channel programme ${tag} ${runSuffix}`;
  const programme = await prisma.programme.create({
    data: { key: `e2e-cc-p-${tag}-${runSuffix}`, name, nameEn: name, tenantId: tenant.id },
    select: { id: true, key: true, nameEn: true },
  });
  createdTenantIds.push(tenant.id);
  createdProgrammeIds.push(programme.id);
  return programme;
}

function pageUrl(locale = "en") {
  return `${baseURL}/${locale}/admin/channel-clients`;
}

async function openAsAdmin(page: Page) {
  await loginAs(page, "admin");
  await page.goto(pageUrl());
  await expect(page).toHaveURL(/\/en\/admin\/channel-clients$/);
}

async function fillRegistration(page: Page, displayName: string, programme: { key: string; nameEn: string | null }) {
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Issue for programme").selectOption({ label: `${programme.key} · ${programme.nameEn}` });
  await page.getByRole("checkbox", { name: /channel:certificates:verify/ }).check();
  await page.getByRole("button", { name: "Register and issue key" }).click();
}

async function credentialInput(page: Page) {
  const field = page.getByLabel("Open API credential");
  await expect(field).toBeVisible({ timeout: 20_000 });
  return (await field.inputValue()).trim();
}

async function whoami(page: Page, credential: string) {
  return page.request.get(`${baseURL}/api/v1/open/whoami`, {
    headers: { authorization: `Bearer ${credential}` },
  });
}

async function selectRow(page: Page, displayName: string) {
  await page.locator(".admin-list-item", { hasText: displayName }).first().click();
}

test.describe("ADMIN 渠道客户端与密钥页（CP-TODO-260）", () => {
  test.afterAll(async () => {
    if (createdProgrammeIds.length > 0) {
      await prisma.channelClient.deleteMany({ where: { programmeId: { in: createdProgrammeIds } } });
    }
    await prisma.channelClient.deleteMany({ where: { displayName: { contains: runSuffix } } });
    if (createdProgrammeIds.length > 0) await prisma.programme.deleteMany({ where: { id: { in: createdProgrammeIds } } });
    if (createdTenantIds.length > 0) await prisma.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
    await prisma.$disconnect();
  });

  test("门禁：ADMIN 可进入，EVENT_MANAGER 不可", async ({ page }) => {
    await openAsAdmin(page);
    await expect(page.getByRole("heading", { name: "Outward Open API credential registry" })).toBeVisible();

    await page.context().clearCookies();
    await loginAs(page, "eventManager");
    await page.goto(pageUrl());
    await expect(page).not.toHaveURL(/\/admin\/channel-clients$/);
  });

  test("金路：登记即用，改策略、轮换即废旧、撤销即 401", async ({ page }) => {
    const programme = await createProgramme("lifecycle");
    const displayName = `E2E lifecycle client ${runSuffix}`;
    await openAsAdmin(page);

    await fillRegistration(page, displayName, programme);
    const firstCredential = await credentialInput(page);
    expect(firstCredential).toMatch(/^CPK[A-Z0-9]{12}\.cpmk_/);
    expect(firstCredential.length).toBeLessThanOrEqual(136);

    const introspection = await whoami(page, firstCredential);
    expect(introspection.status()).toBe(200);
    const body = await introspection.json();
    expect(body.clientDisplayName ?? body.displayName).toBe(displayName);
    expect(body.key.algorithm).toBe("bcrypt");
    expect(body.programmeId).toBe(programme.id);

    // 列表接口绝不回任何 secret 材料
    const listing = await page.request.get(`${baseURL}/api/admin/channel-clients?programmeId=${programme.id}`);
    expect(listing.status()).toBe(200);
    const listed = await listing.json();
    const listedJson = JSON.stringify(listed);
    expect(listedJson).not.toMatch(/cpmk_|\$2[aby]\$|machineKeyBcrypt|machineKeyHash/);
    expect(listed.clients[0].machineKeyAlgorithm).toBe("bcrypt");
    expect(listed.clients[0].machineKeyConfigured).toBe(true);

    // 改策略：加一个 origin，同时给配额（两项必须成对提交）
    await selectRow(page, displayName);
    await page.getByLabel("Allowed origins").fill("https://e2e-channel-client.example.com");
    await page.getByLabel("Rate limit count").fill("120");
    await page.getByLabel("Rate limit window").fill("120000");
    await page.getByRole("button", { name: "Save policy" }).click();
    await expect(page.getByText("Policy updated.")).toBeVisible();

    const afterPatch = await whoami(page, firstCredential);
    expect(afterPatch.status()).toBe(200);
    expect((await afterPatch.json()).access.allowedOrigins).toEqual(["https://e2e-channel-client.example.com"]);
    expect((await afterPatch.json()).rateLimit.limit).toBe(120);

    // 轮换：应用内弹窗必须收原因，旧 key 当场失效
    await page.getByLabel("New validity in days").fill("30");
    await page.getByRole("button", { name: "Rotate key" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Rotation reason").fill(`e2e scheduled rotation ${runSuffix}`);
    await dialog.getByRole("button", { name: "Confirm rotation" }).click();
    const secondCredential = await credentialInput(page);
    expect(secondCredential).not.toBe(firstCredential);
    expect(secondCredential).toMatch(/^CPK[A-Z0-9]{12}\.cpmk_/);

    expect((await whoami(page, secondCredential)).status()).toBe(200);
    const stale = await whoami(page, firstCredential);
    expect(stale.status()).toBe(401);
    expect((await stale.json()).error.code).toBe("API_KEY_INVALID");

    // 撤销：401 + 原因落库 + 页面转为只读
    await page.getByRole("button", { name: "Revoke client" }).click();
    const revokeDialog = page.getByRole("dialog");
    await revokeDialog.getByLabel("Revocation reason").fill(`e2e revoking in test ${runSuffix}`);
    await revokeDialog.getByRole("button", { name: "Confirm revocation" }).click();
    await expect(page.getByText("Client revoked.")).toBeVisible();
    expect((await whoami(page, secondCredential)).status()).toBe(401);

    const revoked = await prisma.channelClient.findFirst({
      where: { displayName },
      select: { isActive: true, revokedAt: true, revokeReason: true, machineKeyExpiresAt: true },
    });
    expect(revoked?.isActive).toBe(false);
    expect(revoked?.revokeReason).toBe(`e2e revoking in test ${runSuffix}`);
    expect(revoked?.revokedAt).not.toBeNull();
    expect(revoked?.machineKeyExpiresAt?.getTime()).toBeLessThanOrEqual(Date.now() + 31 * 24 * 60 * 60 * 1000);

    await selectRow(page, displayName);
    await expect(page.getByText("Revoked and read-only.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Revoke client" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Save policy" })).toBeDisabled();
  });

  test("scope 是硬门：未勾任何 scope 时提交按钮不可用", async ({ page }) => {
    const programme = await createProgramme("scope");
    await openAsAdmin(page);
    await page.getByLabel("Display name").fill(`E2E no scope ${runSuffix}`);
    await page.getByLabel("Issue for programme").selectOption({ label: `${programme.key} · ${programme.nameEn}` });
    await expect(page.getByRole("button", { name: "Register and issue key" })).toBeDisabled();

    await page.getByRole("checkbox", { name: /channel:source:resolve/ }).check();
    await expect(page.getByRole("button", { name: "Register and issue key" })).toBeEnabled();
    await page.getByRole("button", { name: "Register and issue key" }).click();
    const credential = await credentialInput(page);
    expect((await whoami(page, credential)).status()).toBe(200);
  });

  test("清单分页：搜索与翻页都由服务端完成，一页 25 行", async ({ page }) => {
    const programme = await createProgramme("paging");
    const keySeed = runSuffix.replace(/[^A-Za-z0-9]/g, "").slice(0, 9);
    const totalRows = 30;
    await prisma.channelClient.createMany({
      data: Array.from({ length: totalRows }, (_, index) => ({
        key: `CPKP${keySeed}${String(index).padStart(2, "0")}`.slice(0, 15),
        displayName: `E2E paging client ${runSuffix} ${index}`,
        type: "MACHINE" as const,
        programmeId: programme.id,
        allowedScopes: ["channel:source:resolve"],
      })),
    });

    await openAsAdmin(page);
    await page.getByLabel("Keyword").fill(`E2E paging client ${runSuffix}`);
    await page.getByRole("button", { name: "Search" }).click();

    await expect(page.getByRole("heading", { name: `Credential list · ${totalRows}` })).toBeVisible();
    await expect(page.locator(".admin-list-item")).toHaveCount(25);

    // createMany 让 30 行共享同一个 createdAt，没有次级排序键就会跨页重复或漏行。
    const seenFirstPage = await page.locator(".admin-list-item p").nth(0).innerText();
    const next = page.getByRole("button", { name: "Next" });
    await expect(next).toBeEnabled();
    await next.click();
    await expect(page.getByText("2 / 2")).toBeVisible();
    await expect(page.locator(".admin-list-item")).toHaveCount(totalRows - 25);

    const previous = page.getByRole("button", { name: "Previous" });
    await expect(previous).toBeEnabled();
    await previous.click();
    await expect(page.getByText("1 / 2")).toBeVisible();
    await expect(page.locator(".admin-list-item")).toHaveCount(25);
    await expect(page.locator(".admin-list-item p").nth(0)).toHaveText(seenFirstPage);
    await expect(previous).toBeDisabled();
  });

  test("四屏宽：登记、一次性明文与策略面板都无横向溢出", async ({ page }) => {
    const programme = await createProgramme("viewport");
    const displayName = `E2E viewport client ${runSuffix}`;
    await openAsAdmin(page);
    await fillRegistration(page, displayName, programme);
    await credentialInput(page);

    for (const state of ["明文回显", "策略面板"] as const) {
      if (state === "策略面板") {
        await selectRow(page, displayName);
        await expect(page.getByText("Credential and policy")).toBeVisible();
      }
      for (const viewport of [
        { width: 360, height: 800 },
        { width: 768, height: 1024 },
        { width: 1024, height: 768 },
        { width: 1440, height: 900 },
      ]) {
        await page.setViewportSize(viewport);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow, `${state} 在 ${viewport.width}px 下横向溢出 ${overflow}px`).toBeLessThanOrEqual(1);
      }
    }
    await expect(page.getByRole("button", { name: "Register a new client" })).toBeVisible();
  });
});
