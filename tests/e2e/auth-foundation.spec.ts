import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { expect, test, type Page } from "@playwright/test";
import { locales, testData } from "../fixtures/test-data";

const prisma = new PrismaClient();
const recoveryEmail = `cp-auth-recovery-${Date.now()}@example.test`;
const initialPassword = "InitialTestPassword123!";
const replacementPassword = "ReplacementPassword123!";

async function apiLogin(page: Page, locale: "en" | "zh", email: string, password: string) {
  const response = await page.request.post("/api/auth/login", { data: { locale, email, password } });
  expect(response.status()).toBe(200);
  return response;
}

test.describe.serial("authentication foundation", () => {
  test.beforeAll(async () => {
    await prisma.user.create({
      data: {
        email: recoveryEmail,
        password: await hash(initialPassword, 10),
        name: "CP Recovery Fixture",
        role: "ATTENDEE",
        status: "ACTIVE",
        emailVerified: new Date(),
      },
    });
  });

  test.afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: recoveryEmail } });
    await prisma.$disconnect();
  });

  for (const locale of locales) {
    test(`${locale} login establishes a real attendee session`, async ({ page }) => {
      const attendee = testData.seededUsers.attendee;
      await apiLogin(page, locale, attendee.email, attendee.password);
      const session = await page.request.get("/api/auth/session");
      expect(session.status()).toBe(200);
      const body = await session.json();
      expect(body.authenticated).toBe(true);
      expect(body.user.role).toBe("ATTENDEE");
    });
  }

  for (const fixture of [
    testData.seededUsers.admin,
    testData.seededUsers.eventManager,
    testData.seededUsers.verifier,
    testData.seededUsers.attendee,
  ]) {
    test(`${fixture.role} fixture enforces admin navigation boundary`, async ({ page }) => {
      await apiLogin(page, "en", fixture.email, fixture.password);
      const session = await page.request.get("/api/auth/session");
      expect((await session.json()).user.role).toBe(fixture.role);

      await page.goto("/en/admin/events");
      if (["ADMIN", "EVENT_MANAGER"].includes(fixture.role)) {
        await expect(page).toHaveURL(/\/en\/admin\/events/);
        await expect(page.locator("main")).toBeVisible();
      } else {
        await expect(page).toHaveURL(/\/en\/dashboard\/climate-passport/);
      }
    });
  }

  test("password recovery uses the isolated mail outbox end to end", async ({ page }) => {
    const requested = await page.request.post("/api/auth/forgot-password", { data: { locale: "en", email: recoveryEmail } });
    expect(requested.status()).toBe(200);

    const outboxPath = path.resolve(process.env.MAIL_TEST_OUTBOX_PATH!);
    const messages = (await readFile(outboxPath, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
    const message = messages.reverse().find((item) => item.to === recoveryEmail && item.subject.includes("Reset"));
    expect(message).toBeTruthy();
    const code = String(message.text).match(/\b\d{6}\b/)?.[0];
    expect(code).toMatch(/^\d{6}$/);

    const reset = await page.request.post("/api/auth/reset-password", {
      data: { email: recoveryEmail, code, password: replacementPassword },
    });
    expect(reset.status()).toBe(200);
    await apiLogin(page, "en", recoveryEmail, replacementPassword);
  });

  test("an active session is invalidated when its account becomes suspended", async ({ page }) => {
    await apiLogin(page, "en", recoveryEmail, replacementPassword);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: recoveryEmail }, select: { id: true } });
    const sessionsBeforeSuspension = await prisma.session.count({ where: { userId: user.id } });
    await prisma.user.update({ where: { id: user.id }, data: { status: "SUSPENDED" } });
    try {
      const session = await page.request.get("/api/auth/session");
      expect(session.status()).toBe(200);
      expect((await session.json()).authenticated).toBe(false);
      expect(await prisma.session.count({ where: { userId: user.id } })).toBe(sessionsBeforeSuspension - 1);
    } finally {
      await prisma.user.update({ where: { id: user.id }, data: { status: "ACTIVE" } });
    }
  });
});
