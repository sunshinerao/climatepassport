import { createHash, randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { expect, test, type Page } from "@playwright/test";

const prisma = new PrismaClient();
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = "CertificateArtifact123!";
const ownerEmail = `cp-certificate-owner-${suffix}@example.test`;
const strangerEmail = `cp-certificate-stranger-${suffix}@example.test`;
const adminEmail = `cp-certificate-admin-${suffix}@example.test`;
const storageRoot = path.resolve(process.env.CERTIFICATE_ARTIFACT_LOCAL_ROOT!);
const artifactBytes = Buffer.from("<!doctype html><html><body>Certificate artifact fixture</body></html>", "utf8");
const artifactSha256 = createHash("sha256").update(artifactBytes).digest("hex");
const issueId = randomUUID();
const missingIssueId = randomUUID();
const artifactKey = `certificates/${issueId}/${artifactSha256}.html`;
const fileName = "课程证书-气候行动-王小明-CV-TEST-001.html";
const verificationCode = `CV-ART-${suffix}`.toUpperCase();

let ownerId: string;
let strangerId: string;
let adminId: string;
let categoryId: string;
let templateId: string;
let definitionId: string;
let activityId: string;
let pdfIssueId: string | undefined;
let pdfUserId: string | undefined;

async function login(page: Page, email: string) {
  const response = await page.request.post("/api/auth/login", { data: { locale: "zh", email, password } });
  expect(response.status()).toBe(200);
}

async function downloadCount(id: string) {
  return (await prisma.certificateIssue.findUniqueOrThrow({ where: { id }, select: { downloadCount: true } })).downloadCount;
}

test.describe.serial("certificate private artifact delivery", () => {
  test.beforeAll(async () => {
    expect(process.env.CERTIFICATE_ARTIFACT_STORAGE).toBe("local");
    expect(path.isAbsolute(storageRoot)).toBe(true);

    const passwordHash = await hash(password, 10);
    const [owner, stranger, admin] = await Promise.all([
      prisma.user.create({ data: { email: ownerEmail, password: passwordHash, name: "Artifact Owner", role: "ATTENDEE", status: "ACTIVE", emailVerified: new Date() } }),
      prisma.user.create({ data: { email: strangerEmail, password: passwordHash, name: "Artifact Stranger", role: "ATTENDEE", status: "ACTIVE", emailVerified: new Date() } }),
      prisma.user.create({ data: { email: adminEmail, password: passwordHash, name: "Artifact Admin", role: "ADMIN", status: "ACTIVE", emailVerified: new Date() } }),
    ]);
    ownerId = owner.id;
    strangerId = stranger.id;
    adminId = admin.id;

    const category = await prisma.certificateCategory.create({
      data: { key: `artifact-${suffix}`, name: "Artifact Test", nameEn: "Artifact Test" },
    });
    categoryId = category.id;
    const template = await prisma.certificateTemplate.create({
      data: { categoryId, name: "Artifact Template", nameEn: "Artifact Template", templateType: "CUSTOM", templateConfigJson: {} },
    });
    templateId = template.id;
    const definition = await prisma.certificateDefinition.create({
      data: { categoryId, templateId, name: "Artifact Credential", nameEn: "Artifact Credential" },
    });
    definitionId = definition.id;
    const activity = await prisma.activity.create({
      data: { type: "EVENT", title: "Issuing Rule Activity", slug: `issuing-rule-${suffix}`, status: "PUBLISHED", organizerUserId: adminId, createdByUserId: adminId },
    });
    activityId = activity.id;

    await mkdir(path.dirname(path.join(storageRoot, artifactKey)), { recursive: true });
    await writeFile(path.join(storageRoot, artifactKey), artifactBytes, { mode: 0o600 });
    await prisma.certificateIssue.createMany({
      data: [
        {
          id: issueId,
          definitionId,
          userId: ownerId,
          status: "ISSUED",
          generatedFileName: fileName,
          artifactProvider: "local",
          artifactKey,
          artifactVersion: artifactSha256,
          artifactContentType: "text/html; charset=utf-8",
          artifactByteSize: artifactBytes.length,
          artifactSha256,
          artifactCreatedAt: new Date(),
          artifactVerifiedAt: new Date(),
          artifactState: "READY",
          verificationCode,
          issuedAt: new Date(),
          variableValuesJson: {
            certificateNameEn: "Issued Credential EN",
            categoryNameEn: "Issued Category EN",
            issuerName: "Issued Organization",
            capabilityTags: ["Issued Capability"],
          },
          renderSnapshotJson: {
            schemaVersion: 1,
            templateId,
            templateVersion: 1,
            renderConfigJson: {},
            holderName: "Issued Holder",
            certificateName: "Issued Credential",
            categoryName: "Issued Category",
            issueDate: new Date().toISOString(),
            variableValues: {
              certificateNameEn: "Issued Credential EN",
              categoryNameEn: "Issued Category EN",
              issuerName: "Issued Organization",
              capabilityTags: ["Issued Capability"],
            },
          },
        },
        {
          id: missingIssueId,
          definitionId,
          userId: ownerId,
          status: "ISSUED",
          generatedFileName: "missing.html",
          artifactProvider: "local",
          artifactKey: `certificates/${missingIssueId}/${"0".repeat(64)}.html`,
          artifactVersion: "0".repeat(64),
          artifactContentType: "text/html; charset=utf-8",
          artifactByteSize: 1,
          artifactSha256: "0".repeat(64),
          artifactCreatedAt: new Date(),
          artifactVerifiedAt: new Date(),
          artifactState: "READY",
          verificationCode: `CV-MISSING-${suffix}`,
          issuedAt: new Date(),
        },
      ],
    });
  });

  test.afterAll(async () => {
    await prisma.activity.deleteMany({ where: { id: activityId } });
    await prisma.certificateIssue.deleteMany({ where: { id: { in: [issueId, missingIssueId, ...(pdfIssueId ? [pdfIssueId] : [])] } } });
    await prisma.certificateDefinition.deleteMany({ where: { id: definitionId } });
    await prisma.certificateTemplate.deleteMany({ where: { id: templateId } });
    await prisma.certificateCategory.deleteMany({ where: { id: categoryId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, strangerId, adminId, ...(pdfUserId ? [pdfUserId] : [])] } } });
    await rm(path.join(storageRoot, "certificates", issueId), { recursive: true, force: true });
    if (pdfIssueId) await rm(path.join(storageRoot, "certificates", pdfIssueId), { recursive: true, force: true });
    await prisma.$disconnect();
  });

  test("inline owner preview is private and does not increment", async ({ page }) => {
    await login(page, ownerEmail);
    const response = await page.request.get(`/api/certificates/${issueId}/artifact?disposition=inline`);
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toBe("private, no-store");
    expect(response.headers()["content-security-policy"]).toContain("sandbox");
    expect(await downloadCount(issueId)).toBe(0);
  });

  test("stranger is denied without incrementing", async ({ page }) => {
    await login(page, strangerEmail);
    const response = await page.request.get(`/api/certificates/${issueId}/artifact`);
    expect(response.status()).toBe(403);
    expect(await downloadCount(issueId)).toBe(0);
  });

  test("admin and owner attachments each persist exactly one download", async ({ page }) => {
    await login(page, adminEmail);
    const adminResponse = await page.request.get(`/api/certificates/${issueId}/artifact`);
    expect(adminResponse.status()).toBe(200);
    expect(await downloadCount(issueId)).toBe(1);

    await page.request.post("/api/auth/logout");
    await login(page, ownerEmail);
    const ownerResponse = await page.request.get(`/api/certificates/${issueId}/artifact`);
    expect(ownerResponse.status()).toBe(200);
    expect(ownerResponse.headers()["content-disposition"]).toContain("filename*=UTF-8''");
    expect(decodeURIComponent(ownerResponse.headers()["content-disposition"].split("filename*=UTF-8''")[1])).toBe(fileName);
    expect(await downloadCount(issueId)).toBe(2);
  });

  test("missing artifact is marked missing without incrementing", async ({ page }) => {
    await login(page, ownerEmail);
    const response = await page.request.get(`/api/certificates/${missingIssueId}/artifact`);
    expect(response.status()).toBe(404);
    const issue = await prisma.certificateIssue.findUniqueOrThrow({
      where: { id: missingIssueId },
      select: { artifactState: true, downloadCount: true },
    });
    expect(issue.artifactState).toBe("MISSING");
    expect(issue.downloadCount).toBe(0);
  });

  test("public verification keeps the immutable issued identity after profile and definition edits", async ({ browser }) => {
    await prisma.user.update({ where: { id: ownerId }, data: { name: "Changed Holder" } });
    await prisma.certificateDefinition.update({ where: { id: definitionId }, data: { name: "Changed Credential", nameEn: "Changed Credential" } });
    await prisma.certificateCategory.update({ where: { id: categoryId }, data: { name: "Changed Category", nameEn: "Changed Category" } });

    const context = await browser.newContext();
    try {
      const response = await context.request.get(`/api/certificates/verify/${encodeURIComponent(verificationCode)}?source=QR_SCAN`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.accessLevel).toBe("PUBLIC");
      expect(body.certificate.holderName).toBe("Issued Holder");
      expect(body.certificate.title).toBe("Issued Credential");
      expect(body.certificate.titleEn).toBe("Issued Credential EN");
      expect(body.certificate.credentialType).toBe("Issued Category");
      expect(body.certificate.issuingOrganization).toBe("Issued Organization");
      expect(body.certificate.extended).toBeUndefined();
      expect(body.certificate.holderEmail).toBeUndefined();
    } finally {
      await context.close();
    }
  });

  test("concurrent lifecycle changes are atomic and retain revocation provenance", async ({ page }) => {
    await login(page, adminEmail);
    const revokeResponses = await Promise.all([
      page.request.post(`/api/admin/certificates/${issueId}/revoke`, { data: { reason: "Credential issued in error A" } }),
      page.request.post(`/api/admin/certificates/${issueId}/revoke`, { data: { reason: "Credential issued in error B" } }),
    ]);
    expect(revokeResponses.map((response) => response.status()).sort()).toEqual([200, 409]);

    const revoked = await prisma.certificateIssue.findUniqueOrThrow({ where: { id: issueId } });
    expect(revoked.status).toBe("REVOKED");
    expect(revoked.revokedByUserId).toBe(adminId);
    expect(revoked.revokedAt).toBeTruthy();
    expect(["Credential issued in error A", "Credential issued in error B"]).toContain(revoked.revocationReason);

    const verifyRevoked = await page.request.get(`/api/certificates/verify/${encodeURIComponent(verificationCode)}?source=QR_SCAN`);
    expect((await verifyRevoked.json()).result).toBe("REVOKED");

    const restoreResponses = await Promise.all([
      page.request.post(`/api/admin/certificates/${issueId}/restore`),
      page.request.post(`/api/admin/certificates/${issueId}/restore`),
    ]);
    expect(restoreResponses.map((response) => response.status()).sort()).toEqual([200, 409]);

    const restored = await prisma.certificateIssue.findUniqueOrThrow({ where: { id: issueId } });
    expect(restored.status).toBe("ISSUED");
    expect(restored.restoredByUserId).toBe(adminId);
    expect(restored.restoredAt).toBeTruthy();
    expect(restored.revocationReason).toBe(revoked.revocationReason);
  });

  test("issued credentials and referenced configuration cannot be physically deleted", async ({ page }) => {
    await login(page, adminEmail);
    expect((await page.request.delete(`/api/admin/certificates/${issueId}`)).status()).toBe(409);
    expect((await page.request.delete("/api/admin/certificates/templates", { data: { id: templateId } })).status()).toBe(409);
    expect((await page.request.delete("/api/admin/certificates/categories", { data: { id: categoryId } })).status()).toBe(409);
    expect(await prisma.certificateIssue.count({ where: { id: issueId } })).toBe(1);
  });

  test("issuing rules persist only the supported Activity check-in trigger", async ({ page }) => {
    await login(page, adminEmail);
    const unsupported = await page.request.post("/api/admin/certificates/rules", {
      data: { name: "Unsupported course rule", activityId, certificateDefinitionId: definitionId, trigger: "COURSE_COMPLETION", isActive: true, notifyUser: true, requiresAdminConfirmation: false, conditionJson: null },
    });
    expect(unsupported.status()).toBe(400);

    const created = await page.request.post("/api/admin/certificates/rules", {
      data: { name: "Activity check-in certificate", activityId, certificateDefinitionId: definitionId, trigger: "ACTIVITY_CHECKIN", isActive: true, notifyUser: true, requiresAdminConfirmation: false, conditionJson: null },
    });
    expect(created.status()).toBe(201);
    const createdBody = await created.json();
    expect(createdBody.rule.effective).toBe(true);
    const ruleId = createdBody.rule.id as string;

    const duplicate = await page.request.post("/api/admin/certificates/rules", {
      data: { name: "Duplicate check-in rule", activityId, certificateDefinitionId: definitionId, trigger: "ACTIVITY_CHECKIN", isActive: false, notifyUser: true, requiresAdminConfirmation: false, conditionJson: null },
    });
    expect(duplicate.status()).toBe(409);

    const listed = await page.request.get(`/api/admin/certificates/rules?activityId=${activityId}`);
    expect(listed.status()).toBe(200);
    const listedBody = await listed.json();
    expect(listedBody.capabilities.supportedTriggers).toEqual(["ACTIVITY_CHECKIN"]);
    expect(listedBody.capabilities.unsupportedTriggers).toContain("COURSE_COMPLETION");
    expect(listedBody.rules).toHaveLength(1);

    const disabled = await page.request.patch("/api/admin/certificates/rules", { data: { id: ruleId, isActive: false, notifyUser: false } });
    expect(disabled.status()).toBe(200);
    expect((await disabled.json()).rule.effective).toBe(false);
    const persisted = await prisma.activityCertificateRule.findUniqueOrThrow({ where: { id: ruleId } });
    expect(persisted.isActive).toBe(false);
    expect(persisted.notifyUser).toBe(false);

    await page.request.post("/api/auth/logout");
    await login(page, strangerEmail);
    expect((await page.request.patch("/api/admin/certificates/rules", { data: { id: ruleId, isActive: true } })).status()).toBe(403);
  });

  test("manual issuance renders, stores and privately serves a real PDF", async ({ page }) => {
    await login(page, adminEmail);
    const recipientEmail = `cp-pdf-recipient-${suffix}@example.test`;
    const issued = await page.request.post("/api/admin/certificates/issue", {
      data: {
        email: recipientEmail,
        templateId,
        variableValues: {
          holderName: "王小明 Long Holder Name",
          certificateName: "气候行动证书",
          categoryName: "课程证书",
        },
      },
      timeout: 30_000,
    });
    expect(issued.status()).toBe(200);
    const issuedBody = await issued.json();
    pdfIssueId = issuedBody.issueId;
    const persisted = await prisma.certificateIssue.findUniqueOrThrow({ where: { id: pdfIssueId! } });
    pdfUserId = persisted.userId;
    expect(persisted.artifactContentType).toBe("application/pdf");
    expect(persisted.artifactKey).toMatch(/\.pdf$/);
    expect(persisted.generatedFileName).toMatch(/课程证书-气候行动证书-王小明 Long Holder Name-.*\.pdf$/);
    expect(persisted.artifactByteSize).toBeGreaterThan(5_000);

    const downloaded = await page.request.get(`/api/certificates/${pdfIssueId}/artifact`);
    expect(downloaded.status()).toBe(200);
    expect(downloaded.headers()["content-type"]).toBe("application/pdf");
    expect((await downloaded.body()).subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(downloaded.headers()["content-disposition"]).toContain("filename*=UTF-8''");

    const verified = await page.request.get(`/api/certificates/verify/${encodeURIComponent(issuedBody.verificationCode)}?source=QR_SCAN`);
    expect(verified.status()).toBe(200);
    const verifiedBody = await verified.json();
    expect(verifiedBody.valid).toBe(true);
    expect(verifiedBody.certificate.holderName).toBe("王小明 Long Holder Name");
  });
});
