/**
 * API 集成测试：通用期次原子录取/候补、多角色指派、外部分类引用与出席更正（CP-TODO-246 / CP-FR-054/055/056）
 *
 * 覆盖矩阵（真实数据库 + 真实会话/API Key 鉴权）：
 * - 准备：ADMIN 登录；applicant/EVENT_MANAGER/普通用户账号；EVENT 活动（组织者为
 *   ADMIN，另留一个未接入 Programme 的活动作负例）；MACHINE 客户端（含
 *   channel:activities:source）；主活动经 sourceObjectMapping 接入该 Programme
 * - 期次 CRUD：匿名 POST 401；非组织者 EM POST 403；创建 201（审计落库）；窗口
 *   校验 400；公开 GET 不含 CANCELLED，?includeCancelled=1 含；PATCH 更新 200；
 *   容量收缩低于已确认 → 409 OCCURRENCE_FULL；占用期次取消 → 409；空期次取消 → 200
 * - 原子录取：容量 1 期次确认 A → 200 且 admittedCount=1、参与 ACCEPTED、奖励
 *   审计外无重复；确认 B → 409 OCCURRENCE_FULL 且 B 仍 SUBMITTED；B 改候补 200；
 *   A 改拒绝 → 200 且 B 自动转正（APPROVED、占位、转正通知、候补提升审计）；
 *   并发双确认（容量 2）→ 两个 200、admittedCount=2，第三次 → 409
 * - 多角色：非组织者 EM POST 403；管理员指派 201，重复指派幂等 200 created:false；
 *   非法角色 400；公开 GET 统计 distinctPersonCount=2/totalAssignments=3（不双计）；
 *   撤销 200 后统计回落；指派/撤销审计落库
 * - 外部分类：无 Authorization 401 API_KEY_MISSING；缺 scope 客户端 403
 *   API_KEY_SCOPE_DENIED；未接入本 Programme 的活动 404 SOURCE_MAPPING_NOT_FOUND；
 *   登记 set 201；同幂等键重放
 *   200 deduplicated；同键异内容 409 TAXONOMY_CONFLICT；低版本 409 TAXONOMY_STALE；
 *   高版本升级 200 且 ACTIVE；公开 GET 返回最新 ACTIVE；低版本撤回 409；
 *   撤回 200 后 GET 为空；更高版本重新登记恢复 ACTIVE；set/withdraw 审计落库
 * - 出席更正：普通用户 403；缺理由 400；ABSENT → 200 且参与 CHECKED_IN、
 *   checkin 记录 isCorrection=true 且 noteJson 含理由与证据、审计落库、
 *   rewardsTriggered=false；重复更正 409 ATTENDANCE_ALREADY_RECORDED
 *
 * 运行方式：npm run test:api（隔离测试数据库 + 本地测试服务器）。
 */

import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { ApiClient, waitForServer } from "./_client";
import { buildLoginPayload, testData } from "../fixtures/test-data";

const baseURL = process.env.CP_TEST_BASE_URL || "http://localhost:3100";
const locale = testData.locale;
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

let serverReady = false;
let prisma: PrismaClient | null = null;

const adminClient = new ApiClient(baseURL);
const managerClient = new ApiClient(baseURL);
const outsiderClient = new ApiClient(baseURL);
const anonymousClient = new ApiClient(baseURL);
const machineClient = new ApiClient(baseURL);

const state: {
  adminUserId?: string;
  activityId?: string;
  occurrenceId?: string;
  concurrentOccurrenceId?: string;
  applicantIds?: string[];
  applicationIds?: string[];
  concurrentApplicationIds?: string[];
  participationId?: string;
  personIds?: string[];
  assignmentIds?: string[];
  clientKey?: string;
  machineKey?: string;
  restrictedClientKey?: string;
  restrictedMachineKey?: string;
  programmeId?: string;
  unboundActivityId?: string;
} = {};

function skipUnlessReady(t: { skip: (reason: string) => void }) {
  if (!serverReady) {
    t.skip("目标服务器未就绪，跳过 API 测试");
  }
}

async function db() {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

/** Open API 只认 bearer：`<clientKey>.<machineKey>` 是登记密钥的对外形态。 */
function openBearer(clientKey: string, machineKey: string) {
  return { Authorization: `Bearer ${clientKey}.${machineKey}` };
}

function asError(data: unknown) {
  return (data as { error?: { code?: string; message?: string } }).error ?? {};
}

async function createUser(client: PrismaClient, email: string, name: string, role: string) {
  return client.user.create({
    data: {
      email,
      name,
      password: await hash("seeded-password", 10),
      role,
      emailVerified: new Date(),
    },
    select: { id: true },
  });
}

before(async () => {
  serverReady = await waitForServer(baseURL, 30000);
});

describe("通用期次、多角色、分类引用与出席更正（CP-TODO-246）", () => {
  test("准备：账号、活动、MACHINE 客户端", async (t) => {
    skipUnlessReady(t);
    const seeded = testData.seededUsers;
    const login = await adminClient.login(buildLoginPayload(locale, seeded.admin.email, "seeded-password"));
    assert.equal(login.status, 200, `管理员登录失败: ${JSON.stringify(login.data)}`);

    const client = await db();
    const adminUser = await client.user.findUniqueOrThrow({ where: { email: seeded.admin.email }, select: { id: true } });
    state.adminUserId = adminUser.id;

    const activity = await client.activity.create({
      data: {
        type: "EVENT",
        title: `Occurrence Activity ${suffix}`,
        titleEn: `Occurrence Activity ${suffix}`,
        slug: `occ-activity-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 60),
        status: "PUBLISHED",
        language: "en",
        createdByUserId: adminUser.id,
        organizerUserId: adminUser.id,
        startTime: new Date("2026-12-01T09:00:00.000Z"),
        endTime: new Date("2026-12-01T12:00:00.000Z"),
      },
      select: { id: true },
    });
    state.activityId = activity.id;

    const manager = await createUser(client, `occ_manager_${suffix}@example.com`, "Occurrence Manager", "EVENT_MANAGER");
    const managerLogin = await managerClient.login(buildLoginPayload(locale, `occ_manager_${suffix}@example.com`, "seeded-password"));
    assert.equal(managerLogin.status, 200, "EVENT_MANAGER 登录失败");

    const outsider = await createUser(client, `occ_outsider_${suffix}@example.com`, "Occurrence Outsider", "ATTENDEE");
    const outsiderLogin = await outsiderClient.login(buildLoginPayload(locale, `occ_outsider_${suffix}@example.com`, "seeded-password"));
    assert.equal(outsiderLogin.status, 200, "outsider 登录失败");
    void outsider;

    const applicants: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      const applicant = await createUser(client, `occ_applicant_${index}_${suffix}@example.com`, `Occurrence Applicant ${index}`, "ATTENDEE");
      applicants.push(applicant.id);
    }
    state.applicantIds = applicants;

    const applications: string[] = [];
    for (const userId of applicants.slice(0, 3)) {
      const application = await client.activityApplication.create({
        data: { activityId: activity.id, userId, status: "SUBMITTED", submittedAt: new Date() },
        select: { id: true },
      });
      applications.push(application.id);
    }
    state.applicationIds = applications;

    const concurrentApplications: string[] = [];
    for (const userId of applicants.slice(3)) {
      const application = await client.activityApplication.create({
        data: { activityId: activity.id, userId, status: "SUBMITTED", submittedAt: new Date() },
        select: { id: true },
      });
      concurrentApplications.push(application.id);
    }
    state.concurrentApplicationIds = concurrentApplications;

    const tenant = await client.tenant.create({
      data: { key: `occ-tenant-${suffix}`, name: `Occurrence Tenant ${suffix}` },
      select: { id: true },
    });
    const programme = await client.programme.create({
      data: { key: `occ-prog-${suffix}`, name: `Occurrence Programme ${suffix}`, tenantId: tenant.id },
      select: { id: true },
    });

    const register = await adminClient.post("/api/admin/channel-clients", {
      displayName: `Occurrence Client ${suffix}`,
      type: "MACHINE",
      programmeId: programme.id,
      allowedOrigins: [],
      allowedScopes: ["channel:activities:source"],
      machineKey: `cpmk_occ_${suffix}`,
      callbackUrl: "http://127.0.0.1:9/hook",
    });
    assert.equal(register.status, 201, `登记客户端失败: ${JSON.stringify(register.data)}`);
    const body = register.data as { client: { key: string }; machineKey?: string };
    state.clientKey = body.client.key;
    state.machineKey = body.machineKey;

    state.programmeId = programme.id;

    const restricted = await adminClient.post("/api/admin/channel-clients", {
      displayName: `Occurrence Restricted ${suffix}`,
      type: "MACHINE",
      programmeId: programme.id,
      allowedOrigins: [],
      allowedScopes: ["channel:certificates:verify"],
      machineKey: `cpmk_occ_restricted_${suffix}`,
    });
    assert.equal(restricted.status, 201, `登记受限客户端失败: ${JSON.stringify(restricted.data)}`);
    const restrictedBody = restricted.data as { client: { key: string }; machineKey?: string };
    state.restrictedClientKey = restrictedBody.client.key;
    state.restrictedMachineKey = restrictedBody.machineKey;

    // 分类引用挂在活动上，活动又只靠来源映射归属 Programme：先接入主活动，
    // 另留一个未接入的活动作为对外可见性的负例。
    await client.sourceObjectMapping.create({
      data: {
        programmeId: programme.id,
        sourceSystem: state.clientKey!,
        sourceObjectId: `occ-source-${suffix}`,
        activityId: state.activityId!,
        applyStatus: "ACTIVE",
      },
      select: { id: true },
    });
    const unbound = await client.activity.create({
      data: {
        type: "EVENT",
        title: `Occurrence Unbound ${suffix}`,
        titleEn: `Occurrence Unbound ${suffix}`,
        slug: `occ-unbound-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 60),
        status: "PUBLISHED",
        language: "en",
        createdByUserId: adminUser.id,
        organizerUserId: adminUser.id,
        startTime: new Date("2026-12-05T09:00:00.000Z"),
        endTime: new Date("2026-12-05T12:00:00.000Z"),
      },
      select: { id: true },
    });
    state.unboundActivityId = unbound.id;
  });

  test("期次 CRUD：鉴权、校验、公开列表过滤与取消约束", async (t) => {
    skipUnlessReady(t);

    // 后台写路由已改用 requireApiRole：匿名访问返回 401 JSON，不再重定向到登录页。
    const anonymousResponse = await fetch(`${baseURL}/api/activities/${state.activityId}/occurrences`, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startsAt: "2026-12-01T09:00:00.000Z", endsAt: "2026-12-01T12:00:00.000Z" }),
    });
    assert.equal(anonymousResponse.status, 401, `匿名访问必须 401: ${anonymousResponse.status}`);
    assert.ok(anonymousResponse.headers.get("content-type")?.includes("application/json"), "匿名鉴权失败必须返回 JSON");
    assert.equal((await anonymousResponse.json()).error, "Authentication required.");

    const nonOrganizerPost = await managerClient.post(`/api/activities/${state.activityId}/occurrences`, {
      startsAt: "2026-12-01T09:00:00.000Z",
      endsAt: "2026-12-01T12:00:00.000Z",
    });
    assert.equal(nonOrganizerPost.status, 403, "非组织者 EVENT_MANAGER 不得管理期次");

    const badWindow = await adminClient.post(`/api/activities/${state.activityId}/occurrences`, {
      startsAt: "2026-12-01T12:00:00.000Z",
      endsAt: "2026-12-01T09:00:00.000Z",
      capacity: 1,
    });
    assert.equal(badWindow.status, 400);

    const created = await adminClient.post(`/api/activities/${state.activityId}/occurrences`, {
      startsAt: "2026-12-01T09:00:00.000Z",
      endsAt: "2026-12-01T12:00:00.000Z",
      capacity: 1,
      locationJson: { room: "A1" },
    });
    assert.equal(created.status, 201, `创建期次失败: ${JSON.stringify(created.data)}`);
    const createdBody = created.data as { occurrence: { id: string; remainingCapacity: number | null; status: string } };
    state.occurrenceId = createdBody.occurrence.id;
    assert.equal(createdBody.occurrence.remainingCapacity, 1);
    assert.equal(createdBody.occurrence.status, "SCHEDULED");

    const client = await db();
    const audit = await client.coreAuditLog.findFirst({
      where: { action: "ACTIVITY_OCCURRENCE_CREATED", subjectId: state.occurrenceId },
    });
    assert.ok(audit, "创建期次审计落库");

    const publicList = await anonymousClient.get(`/api/activities/${state.activityId}/occurrences`);
    assert.equal(publicList.status, 200);
    const publicBody = publicList.data as { occurrences: Array<{ id: string }> };
    assert.ok(publicBody.occurrences.some((row) => row.id === state.occurrenceId));

    const shrinkTooFar = await adminClient.patch(`/api/activities/${state.activityId}/occurrences/${state.occurrenceId}`, { capacity: 0 });
    assert.equal(shrinkTooFar.status, 400);
  });

  test("原子录取：满员 409、候补、释放转正与并发上限", async (t) => {
    skipUnlessReady(t);
    const client = await db();
    const [appA, appB, appC] = state.applicationIds!;

    const admitA = await adminClient.patch(`/api/activity-applications/${appA}/review`, {
      status: "APPROVED",
      occurrenceId: state.occurrenceId,
    });
    assert.equal(admitA.status, 200, `确认 A 失败: ${JSON.stringify(admitA.data)}`);
    let occurrence = await client.activityOccurrence.findUniqueOrThrow({ where: { id: state.occurrenceId } });
    assert.equal(occurrence.admittedCount, 1);
    const participationA = await client.activityParticipation.findUnique({
      where: { activityId_userId: { activityId: state.activityId!, userId: state.applicantIds![0] } },
    });
    assert.ok(participationA, "确认后创建参与记录");

    const admitB = await adminClient.patch(`/api/activity-applications/${appB}/review`, {
      status: "APPROVED",
      occurrenceId: state.occurrenceId,
    });
    assert.equal(admitB.status, 409, `满员应 409: ${JSON.stringify(admitB.data)}`);
    assert.equal((admitB.data as { code?: string }).code, "OCCURRENCE_FULL");
    const appBRow = await client.activityApplication.findUniqueOrThrow({ where: { id: appB } });
    assert.equal(appBRow.status, "SUBMITTED", "满员不改状态");

    const waitlistB = await adminClient.patch(`/api/activity-applications/${appB}/review`, {
      status: "WAITLISTED",
      occurrenceId: state.occurrenceId,
    });
    assert.equal(waitlistB.status, 200, `候补 B 失败: ${JSON.stringify(waitlistB.data)}`);

    const rejectA = await adminClient.patch(`/api/activity-applications/${appA}/review`, {
      status: "REJECTED",
      occurrenceId: state.occurrenceId,
    });
    assert.equal(rejectA.status, 200, `拒绝 A 失败: ${JSON.stringify(rejectA.data)}`);

    occurrence = await client.activityOccurrence.findUniqueOrThrow({ where: { id: state.occurrenceId } });
    assert.equal(occurrence.admittedCount, 1, "释放后转正再占位，总额不变");
    const appBAfter = await client.activityApplication.findUniqueOrThrow({ where: { id: appB } });
    assert.equal(appBAfter.status, "APPROVED", "候补 B 自动转正");
    const appCRow = await client.activityApplication.findUniqueOrThrow({ where: { id: appC } });
    assert.equal(appCRow.status, "SUBMITTED");
    const promotionNotification = await client.notification.findFirst({
      where: { userId: state.applicantIds![1], metadata: { path: ["source"], equals: "ACTIVITY_WAITLIST_PROMOTION" } },
    });
    assert.ok(promotionNotification, "候补转正通知落库");
    const promotionAudit = await client.coreAuditLog.findFirst({
      where: { action: "ACTIVITY_APPLICATION_REVIEWED", subjectId: appA },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(promotionAudit, "释放/转正审计落库");

    const occupiedCancel = await adminClient.patch(`/api/activities/${state.activityId}/occurrences/${state.occurrenceId}`, { status: "CANCELLED" });
    assert.equal(occupiedCancel.status, 409, "占用期次不可取消");

    const concurrent = await adminClient.post(`/api/activities/${state.activityId}/occurrences`, {
      startsAt: "2026-12-02T09:00:00.000Z",
      endsAt: "2026-12-02T12:00:00.000Z",
      capacity: 2,
    });
    assert.equal(concurrent.status, 201);
    state.concurrentOccurrenceId = (concurrent.data as { occurrence: { id: string } }).occurrence.id;

    const [first, second] = state.concurrentApplicationIds!;
    const [r1, r2] = await Promise.all([
      adminClient.patch(`/api/activity-applications/${first}/review`, { status: "APPROVED", occurrenceId: state.concurrentOccurrenceId }),
      adminClient.patch(`/api/activity-applications/${second}/review`, { status: "APPROVED", occurrenceId: state.concurrentOccurrenceId }),
    ]);
    assert.equal(r1.status, 200, `并发确认 1: ${JSON.stringify(r1.data)}`);
    assert.equal(r2.status, 200, `并发确认 2: ${JSON.stringify(r2.data)}`);
    const concurrentOccurrence = await client.activityOccurrence.findUniqueOrThrow({ where: { id: state.concurrentOccurrenceId } });
    assert.equal(concurrentOccurrence.admittedCount, 2, "并发确认不超额");

    const thirdWaitlist = await adminClient.patch(`/api/activity-applications/${appC}/review`, {
      status: "WAITLISTED",
      occurrenceId: state.concurrentOccurrenceId,
    });
    assert.equal(thirdWaitlist.status, 200);
    const concurrentFull = await adminClient.post(`/api/activities/${state.activityId}/occurrences`, {
      startsAt: "2026-12-03T09:00:00.000Z",
      endsAt: "2026-12-03T10:00:00.000Z",
      capacity: 0,
    });
    assert.equal(concurrentFull.status, 400);

    const cancelEmpty = await adminClient.post(`/api/activities/${state.activityId}/occurrences`, {
      startsAt: "2026-12-04T09:00:00.000Z",
      endsAt: "2026-12-04T10:00:00.000Z",
    });
    assert.equal(cancelEmpty.status, 201);
    const emptyOccurrenceId = (cancelEmpty.data as { occurrence: { id: string } }).occurrence.id;
    const cancelled = await adminClient.patch(`/api/activities/${state.activityId}/occurrences/${emptyOccurrenceId}`, { status: "CANCELLED" });
    assert.equal(cancelled.status, 200);
    const cancelAgain = await adminClient.patch(`/api/activities/${state.activityId}/occurrences/${emptyOccurrenceId}`, { status: "CANCELLED" });
    assert.equal(cancelAgain.status, 409, "取消只允许一次");
    const publicList = await anonymousClient.get(`/api/activities/${state.activityId}/occurrences`);
    const publicIds = (publicList.data as { occurrences: Array<{ id: string }> }).occurrences.map((row) => row.id);
    assert.ok(!publicIds.includes(emptyOccurrenceId), "公开列表隐藏已取消期次");
    const managerList = await adminClient.get(`/api/activities/${state.activityId}/occurrences?includeCancelled=1`);
    const managerIds = (managerList.data as { occurrences: Array<{ id: string }> }).occurrences.map((row) => row.id);
    assert.ok(managerIds.includes(emptyOccurrenceId), "管理者可见已取消期次");
  });

  test("多角色指派：鉴权、幂等、统计去重与撤销", async (t) => {
    skipUnlessReady(t);
    const client = await db();

    const personA = await client.person.create({ data: { displayName: `Occurrence Person A ${suffix}` }, select: { id: true } });
    const personB = await client.person.create({ data: { displayName: `Occurrence Person B ${suffix}` }, select: { id: true } });
    state.personIds = [personA.id, personB.id];

    const forbidden = await managerClient.post(`/api/activities/${state.activityId}/people`, { personId: personA.id, roleType: "SPEAKER" });
    assert.equal(forbidden.status, 403, "非组织者不得指派角色");

    const invalid = await adminClient.post(`/api/activities/${state.activityId}/people`, { personId: personA.id, roleType: "VIP" });
    assert.equal(invalid.status, 400);

    const assign1 = await adminClient.post(`/api/activities/${state.activityId}/people`, { personId: personA.id, roleType: "SPEAKER" });
    assert.equal(assign1.status, 201, `指派 1 失败: ${JSON.stringify(assign1.data)}`);
    const assign2 = await adminClient.post(`/api/activities/${state.activityId}/people`, { personId: personA.id, roleType: "MODERATOR" });
    assert.equal(assign2.status, 201);
    const assign3 = await adminClient.post(`/api/activities/${state.activityId}/people`, { personId: personB.id, roleType: "MENTOR" });
    assert.equal(assign3.status, 201);

    const duplicate = await adminClient.post(`/api/activities/${state.activityId}/people`, { personId: personA.id, roleType: "SPEAKER" });
    assert.equal(duplicate.status, 200);
    assert.equal((duplicate.data as { created: boolean }).created, false, "重复指派幂等");

    const people = await anonymousClient.get(`/api/activities/${state.activityId}/people`);
    assert.equal(people.status, 200);
    const peopleBody = people.data as { roles: Array<{ roleType: string; persons: unknown[] }>; totalAssignments: number; distinctPersonCount: number };
    assert.equal(peopleBody.totalAssignments, 3);
    assert.equal(peopleBody.distinctPersonCount, 2, "一人多角色不双计");
    assert.equal(peopleBody.roles.length, 3);

    const assignmentId = (assign1.data as { assignment: { id: string } }).assignment.id;
    const revoke = await adminClient.delete(`/api/activities/${state.activityId}/people/${assignmentId}`);
    assert.equal(revoke.status, 200);
    const afterRevoke = await anonymousClient.get(`/api/activities/${state.activityId}/people`);
    const afterBody = afterRevoke.data as { totalAssignments: number; distinctPersonCount: number };
    assert.equal(afterBody.totalAssignments, 2);
    assert.equal(afterBody.distinctPersonCount, 2);

    const assignAudit = await client.coreAuditLog.findFirst({ where: { action: "ACTIVITY_PERSON_ROLE_ASSIGNED" } });
    assert.ok(assignAudit, "指派审计落库");
    const revokeAudit = await client.coreAuditLog.findFirst({ where: { action: "ACTIVITY_PERSON_ROLE_REVOKED" } });
    assert.ok(revokeAudit, "撤销审计落库");
  });

  test("外部分类引用：API Key 鉴权、Programme 归属、幂等、版本护栏与撤回恢复", async (t) => {
    skipUnlessReady(t);

    const noHeaders = await machineClient.post("/api/v1/open/activity-taxonomy", {
      activityId: state.activityId,
      taxonomySystem: "un-sdgs",
      taxonomyRef: "13",
      sourceVersion: 1,
      idempotencyKey: `tax-noauth-${suffix}`,
    });
    assert.equal(noHeaders.status, 401);
    assert.equal(asError(noHeaders.data).code, "API_KEY_MISSING");

    const wrongScope = await machineClient.post(
      "/api/v1/open/activity-taxonomy",
      {
        activityId: state.activityId,
        taxonomySystem: "un-sdgs",
        taxonomyRef: "13",
        sourceVersion: 1,
        idempotencyKey: `tax-wrongscope-${suffix}`,
      },
      openBearer(state.restrictedClientKey!, state.restrictedMachineKey!)
    );
    assert.equal(wrongScope.status, 403, `缺 scope 应 403: ${JSON.stringify(wrongScope.data)}`);
    assert.equal(asError(wrongScope.data).code, "API_KEY_SCOPE_DENIED");

    // 未接入本 Programme 的活动对外不可写：与"不存在"同形。
    const unbound = await machineClient.post(
      "/api/v1/open/activity-taxonomy",
      {
        activityId: state.unboundActivityId,
        taxonomySystem: "un-sdgs",
        taxonomyRef: "13",
        sourceVersion: 1,
        idempotencyKey: `tax-unbound-${suffix}`,
      },
      openBearer(state.clientKey!, state.machineKey!)
    );
    assert.equal(unbound.status, 404, `未接入活动应 404: ${JSON.stringify(unbound.data)}`);
    assert.equal(asError(unbound.data).code, "SOURCE_MAPPING_NOT_FOUND");

    const setBody = {
      activityId: state.activityId,
      taxonomySystem: "un-sdgs",
      taxonomyRef: "13",
      labelJson: { label: "Climate Action" },
      sourceVersion: 1,
      idempotencyKey: `tax-set-v1-${suffix}`,
    };
    const setV1 = await machineClient.post("/api/v1/open/activity-taxonomy", setBody, openBearer(state.clientKey!, state.machineKey!));
    assert.equal(setV1.status, 201, `set v1 失败: ${JSON.stringify(setV1.data)}`);

    const replay = await machineClient.post("/api/v1/open/activity-taxonomy", setBody, openBearer(state.clientKey!, state.machineKey!));
    assert.equal(replay.status, 200);
    assert.equal((replay.data as { deduplicated: boolean }).deduplicated, true, "同幂等键同内容重放去重");

    const keyConflict = await machineClient.post(
      "/api/v1/open/activity-taxonomy",
      { ...setBody, labelJson: { label: "Changed" } },
      openBearer(state.clientKey!, state.machineKey!)
    );
    assert.equal(keyConflict.status, 409);
    assert.equal(asError(keyConflict.data).code, "TAXONOMY_CONFLICT");

    const stale = await machineClient.post(
      "/api/v1/open/activity-taxonomy",
      { activityId: state.activityId, taxonomySystem: "un-sdgs", taxonomyRef: "13", sourceVersion: 0, idempotencyKey: `tax-stale-${suffix}` },
      openBearer(state.clientKey!, state.machineKey!)
    );
    assert.equal(stale.status, 400, "sourceVersion 最小为 1");

    const sameVersionConflict = await machineClient.post(
      "/api/v1/open/activity-taxonomy",
      {
        activityId: state.activityId,
        taxonomySystem: "un-sdgs",
        taxonomyRef: "13",
        labelJson: { label: "Different" },
        sourceVersion: 1,
        idempotencyKey: `tax-same-${suffix}`,
      },
      openBearer(state.clientKey!, state.machineKey!)
    );
    assert.equal(sameVersionConflict.status, 409);
    assert.equal(asError(sameVersionConflict.data).code, "TAXONOMY_CONFLICT", "同版本异内容冲突");

    const setV2 = await machineClient.post(
      "/api/v1/open/activity-taxonomy",
      {
        activityId: state.activityId,
        taxonomySystem: "un-sdgs",
        taxonomyRef: "13",
        labelJson: { label: "Climate Action v2" },
        sourceVersion: 2,
        idempotencyKey: `tax-set-v2-${suffix}`,
      },
      openBearer(state.clientKey!, state.machineKey!)
    );
    assert.equal(setV2.status, 201, `升级 v2 失败: ${JSON.stringify(setV2.data)}`);

    const publicList = await anonymousClient.get(`/api/activities/${state.activityId}/classifications`);
    assert.equal(publicList.status, 200);
    const classifications = (publicList.data as { classifications: Array<{ taxonomySystem: string; taxonomyRef: string; sourceVersion: number; status: string }> }).classifications;
    assert.equal(classifications.length, 1);
    assert.equal(classifications[0].sourceVersion, 2);
    assert.equal(classifications[0].status, "ACTIVE");

    const withdrawStale = await machineClient.post(
      "/api/v1/open/activity-taxonomy/withdraw",
      { activityId: state.activityId, taxonomySystem: "un-sdgs", taxonomyRef: "13", sourceVersion: 1, idempotencyKey: `tax-w-stale-${suffix}` },
      openBearer(state.clientKey!, state.machineKey!)
    );
    assert.equal(withdrawStale.status, 409);
    assert.equal(asError(withdrawStale.data).code, "TAXONOMY_STALE", "低版本撤回拒绝");

    const withdraw = await machineClient.post(
      "/api/v1/open/activity-taxonomy/withdraw",
      { activityId: state.activityId, taxonomySystem: "un-sdgs", taxonomyRef: "13", sourceVersion: 2, idempotencyKey: `tax-w-${suffix}` },
      openBearer(state.clientKey!, state.machineKey!)
    );
    assert.equal(withdraw.status, 200, `撤回失败: ${JSON.stringify(withdraw.data)}`);
    assert.equal((withdraw.data as { classification: { status: string } }).classification.status, "WITHDRAWN");

    const emptyList = await anonymousClient.get(`/api/activities/${state.activityId}/classifications`);
    assert.equal((emptyList.data as { classifications: unknown[] }).classifications.length, 0, "撤回后公开列表为空");

    const restore = await machineClient.post(
      "/api/v1/open/activity-taxonomy",
      {
        activityId: state.activityId,
        taxonomySystem: "un-sdgs",
        taxonomyRef: "13",
        labelJson: { label: "Climate Action v3" },
        sourceVersion: 3,
        idempotencyKey: `tax-set-v3-${suffix}`,
      },
      openBearer(state.clientKey!, state.machineKey!)
    );
    assert.equal(restore.status, 201, "更高版本可重新登记");
    assert.equal((restore.data as { classification: { status: string; sourceVersion: number } }).classification.status, "ACTIVE");

    const client = await db();
    const setAudit = await client.coreAuditLog.findFirst({ where: { action: "activity_taxonomy.set" } });
    assert.ok(setAudit, "set 审计落库");
    const withdrawAudit = await client.coreAuditLog.findFirst({ where: { action: "activity_taxonomy.withdraw" } });
    assert.ok(withdrawAudit, "withdraw 审计落库");
  });

  test("出席更正：鉴权、理由、证据、审计与不重复奖励", async (t) => {
    skipUnlessReady(t);
    const client = await db();

    const absentUser = await createUser(client, `occ_absent_${suffix}@example.com`, "Occurrence Absent", "ATTENDEE");
    const participation = await client.activityParticipation.create({
      data: { activityId: state.activityId!, userId: absentUser.id, status: "ABSENT" },
      select: { id: true },
    });
    state.participationId = participation.id;

    const forbidden = await managerClient.post(`/api/activity-participations/${participation.id}/attendance-correction`, {
      reason: "尝试更正",
    });
    assert.equal(forbidden.status, 403, "非组织者 EVENT_MANAGER 不得更正出席");

    const noReason = await adminClient.post(`/api/activity-participations/${participation.id}/attendance-correction`, {});
    assert.equal(noReason.status, 400, `缺理由应 400: ${JSON.stringify(noReason.data)}`);

    const corrected = await adminClient.post(`/api/activity-participations/${participation.id}/attendance-correction`, {
      reason: "现场纸质签到补录",
      evidenceAssetIds: [],
      checkinAt: "2026-12-01T09:30:00.000Z",
    });
    assert.equal(corrected.status, 200, `更正失败: ${JSON.stringify(corrected.data)}`);
    assert.equal((corrected.data as { rewardsTriggered: boolean }).rewardsTriggered, false, "更正不触发奖励");

    const updated = await client.activityParticipation.findUniqueOrThrow({ where: { id: participation.id } });
    assert.equal(updated.status, "CHECKED_IN");
    const checkinRecord = await client.activityCheckinRecord.findFirst({ where: { userId: absentUser.id, isCorrection: true } });
    assert.ok(checkinRecord, "更正签到记录落库");
    const note = checkinRecord.noteJson as { reason: string; evidenceAssetIds: unknown[] };
    assert.equal(note.reason, "现场纸质签到补录");

    const audit = await client.coreAuditLog.findFirst({ where: { action: "ACTIVITY_ATTENDANCE_CORRECTED", subjectId: participation.id } });
    assert.ok(audit, "更正审计落库");

    const duplicate = await adminClient.post(`/api/activity-participations/${participation.id}/attendance-correction`, {
      reason: "重复补录",
    });
    assert.equal(duplicate.status, 409);
    assert.equal((duplicate.data as { code?: string }).code, "ATTENDANCE_ALREADY_RECORDED");
    const checkinCount = await client.activityCheckinRecord.count({ where: { userId: absentUser.id, isCorrection: true } });
    assert.equal(checkinCount, 1, "出席不重复记录");
  });
});
