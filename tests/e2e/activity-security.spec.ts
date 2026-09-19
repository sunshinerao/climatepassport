import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { expect, test, type Page } from "@playwright/test";

const prisma = new PrismaClient();
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = "ActivitySecurity123!";
const managerAEmail = `cp-manager-a-${suffix}@example.test`;
const managerBEmail = `cp-manager-b-${suffix}@example.test`;
const attendeeEmail = `cp-attendee-${suffix}@example.test`;
let managerAId: string;
let managerBId: string;
let attendeeId: string;
let projectId: string;
let participationId: string;

async function login(page: Page, email: string) {
  const response = await page.request.post("/api/auth/login", { data: { locale: "en", email, password } });
  expect(response.status()).toBe(200);
}

test.describe.serial("Activity resource security", () => {
  test.beforeAll(async () => {
    const passwordHash = await hash(password, 10);
    const [managerA, managerB, attendee] = await Promise.all([
      prisma.user.create({ data: { email: managerAEmail, password: passwordHash, name: "Manager A", role: "EVENT_MANAGER", status: "ACTIVE", emailVerified: new Date() } }),
      prisma.user.create({ data: { email: managerBEmail, password: passwordHash, name: "Manager B", role: "EVENT_MANAGER", status: "ACTIVE", emailVerified: new Date() } }),
      prisma.user.create({ data: { email: attendeeEmail, password: passwordHash, name: "=HYPERLINK(\"https://invalid.test\")", role: "ATTENDEE", status: "ACTIVE", emailVerified: new Date() } }),
    ]);
    managerAId = managerA.id;
    managerBId = managerB.id;
    attendeeId = attendee.id;

    const project = await prisma.activity.create({
      data: {
        type: "PROJECT",
        title: `Security Project ${suffix}`,
        slug: `security-project-${suffix}`,
        organizerUserId: managerB.id,
        createdByUserId: managerB.id,
        status: "PUBLISHED",
      },
    });
    projectId = project.id;
    const participation = await prisma.activityParticipation.create({
      data: { activityId: project.id, userId: attendee.id, status: "ACCEPTED", roleType: "PARTICIPANT" },
    });
    participationId = participation.id;
    await prisma.activityApplication.create({
      data: {
        activityId: project.id,
        userId: attendee.id,
        roleType: "PARTICIPANT",
        status: "SUBMITTED",
        submittedAt: new Date(),
        projectConsent: { create: { shareName: true, shareEmail: false } },
      },
    });
  });

  test.afterAll(async () => {
    await prisma.activity.deleteMany({ where: { id: projectId } });
    await prisma.user.deleteMany({ where: { id: { in: [managerAId, managerBId, attendeeId] } } });
    await prisma.$disconnect();
  });

  test("unrelated event manager cannot list, mutate, check in or export another activity", async ({ page }) => {
    await login(page, managerAEmail);
    expect((await page.request.get(`/api/activity-participations?activityId=${projectId}`)).status()).toBe(403);
    expect((await page.request.patch(`/api/activity-participations/${participationId}`, { data: { status: "COMPLETED" } })).status()).toBe(403);
    expect((await page.request.post("/api/activity-checkin", { data: { activityId: projectId, userId: attendeeId, method: "MANUAL" } })).status()).toBe(403);
    expect((await page.request.get(`/api/activities/${projectId}/applications/export`)).status()).toBe(403);

    const unchanged = await prisma.activityParticipation.findUniqueOrThrow({ where: { id: participationId } });
    expect(unchanged.status).toBe("ACCEPTED");
    expect(await prisma.activityCheckinRecord.count({ where: { activityId: projectId } })).toBe(0);
  });

  test("owning manager check-in uses the session actor and remains idempotent", async ({ page }) => {
    await login(page, managerBEmail);
    const first = await page.request.post("/api/activity-checkin", {
      data: { activityId: projectId, userId: attendeeId, method: "MANUAL", verifiedByUserId: managerAId },
    });
    expect(first.status()).toBe(201);
    const second = await page.request.post("/api/activity-checkin", { data: { activityId: projectId, userId: attendeeId, method: "MANUAL" } });
    expect(second.status()).toBe(200);
    expect((await second.json()).status).toBe("DUPLICATE");

    const records = await prisma.activityCheckinRecord.findMany({ where: { activityId: projectId } });
    expect(records).toHaveLength(1);
    expect(records[0].verifiedByUserId).toBe(managerBId);
  });

  test("server-owned participation assets cannot be injected", async ({ page }) => {
    await login(page, managerBEmail);
    const response = await page.request.patch(`/api/activity-participations/${participationId}`, {
      data: { status: "COMPLETED", pointsEarned: 9999, passportSynced: true },
    });
    expect(response.status()).toBe(400);
    const participation = await prisma.activityParticipation.findUniqueOrThrow({ where: { id: participationId } });
    expect(participation.pointsEarned).toBe(0);
    expect(participation.passportSynced).toBe(false);
  });

  test("PROJECT export applies consent minimization and CSV formula protection", async ({ page }) => {
    await login(page, managerBEmail);
    const response = await page.request.get(`/api/activities/${projectId}/applications/export`);
    expect(response.status()).toBe(200);
    const csv = await response.text();
    expect(csv).toContain("'=");
    expect(csv).not.toContain(attendeeEmail);
    expect(csv).not.toContain("Climate Passport ID");
    expect(csv).not.toContain("Review Comment");

    const audit = await prisma.coreAuditLog.findFirst({
      where: { actorUserId: managerBId, action: "ACTIVITY_APPLICATIONS_EXPORTED", subjectId: projectId },
      orderBy: { createdAt: "desc" },
    });
    expect(audit?.result).toBe("SUCCESS");
  });
});
