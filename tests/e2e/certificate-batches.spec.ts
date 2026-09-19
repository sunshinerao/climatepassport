import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { testData } from "../fixtures/test-data";

/**
 * 证书批量签发（CP-TODO-228）浏览器验收。
 *
 * 通过真实登录的管理员会话驱动 /en/admin/certificates/issue 的批量页签：
 * 预检 → 创建批次 → 轮询处理 → 逐项结果，并用真实数据库断言通知与逐项状态。
 */

const prisma = new PrismaClient();
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const batchRecipient = `e2e-batch-${suffix}@example.com`;

async function apiLogin(page: Page, locale: "en" | "zh", email: string, password: string) {
  const response = await page.request.post("/api/auth/login", { data: { locale, email, password } });
  expect(response.status()).toBe(200);
}

test.describe.serial("certificate batch issuance", () => {
  test("admin runs preflight, creates a durable batch and watches per-item results", async ({ page }) => {
    const admin = testData.seededUsers.admin;
    await apiLogin(page, "en", admin.email, admin.password);

    const categoryResponse = await page.request.post("/api/admin/certificates/categories", {
      data: {
        key: `e2e-batch-${suffix}`.toLowerCase().slice(0, 60),
        name: `E2E Batch Category ${suffix}`,
        nameEn: `E2E Batch Category ${suffix}`,
        isActive: true,
      },
    });
    expect(categoryResponse.status()).toBeLessThan(300);
    const category = (await categoryResponse.json()) as { category: { id: string } };
    expect(category.category.id).toBeTruthy();

    const templateResponse = await page.request.post("/api/admin/certificates/templates", {
      data: {
        categoryId: category.category.id,
        name: `E2E Batch Certificate ${suffix}`,
        nameEn: `E2E Batch Certificate ${suffix}`,
        templateType: "ACHIEVEMENT",
        pageSize: "A4_LANDSCAPE",
        isActive: true,
        definitionName: `E2E Batch Definition ${suffix}`,
        approvalMode: "auto",
      },
    });
    expect(templateResponse.status()).toBeLessThan(300);
    const template = (await templateResponse.json()) as { template: { id: string } };
    expect(template.template.id).toBeTruthy();

    await page.goto("/en/admin/certificates/issue");
    await expect(page).toHaveURL(/\/en\/admin\/certificates\/issue/);
    await page.getByRole("button", { name: "Batch Issue" }).click();

    await expect(page.getByText("Recipient Source")).toBeVisible();
    await expect(page.getByRole("button", { name: "Preflight List" })).toBeVisible();
    await expect(page.getByText("In-app notification")).toBeVisible();

    await page.getByLabel(/Certificate Template/).selectOption(template.template.id);
    await page.getByLabel(/Recipient emails/).fill(`${batchRecipient}\nnot-an-email`);
    await page.getByRole("button", { name: "Preflight List" }).click();

    await expect(page.getByText(/Preflight:/)).toBeVisible();
    await expect(page.getByText(/malformed 1/)).toBeVisible();

    await page.getByRole("button", { name: "Create & Process Batch" }).click();

    await expect(page.getByText(new RegExp(`succeeded 1/1`))).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText("Completed", { exact: false }).first()).toBeVisible();

    const batchRow = await prisma.certificateBatchItem.findFirst({
      where: { normalizedEmail: batchRecipient },
      include: { batch: true, certificateIssue: { select: { id: true, status: true, artifactKey: true } } },
    });
    expect(batchRow).toBeTruthy();
    expect(batchRow!.status).toBe("SUCCEEDED");
    expect(batchRow!.certificateIssue?.status).toBe("ISSUED");
    expect(batchRow!.certificateIssue?.artifactKey?.endsWith(".pdf")).toBe(true);
    expect(batchRow!.batch.status).toBe("COMPLETED");

    const recipient = await prisma.user.findUnique({ where: { email: batchRecipient } });
    expect(recipient).toBeTruthy();
    const notifications = await prisma.notification.count({
      where: { userId: recipient!.id, kind: "CERTIFICATE", metadata: { path: ["batchId"], equals: batchRow!.batchId } },
    });
    expect(notifications).toBe(1);

    await expect(page.getByText("Recent Batches")).toBeVisible();
  });
});
