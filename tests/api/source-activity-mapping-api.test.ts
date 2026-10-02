/**
 * API 集成测试：正式活动来源映射执行层（CP-TODO-245 / CP-FR-053）
 *
 * 覆盖矩阵（真实数据库 + 真实 API Key/会话）：
 * - 准备：ADMIN 登录；applicant 登录账号；三个活动（A/B 将被两个来源对象接入、
 *   一个保持未映射）；登记三个 MACHINE 客户端（A/B 含 channel:activities:source
 *   + dispatch:publications，programme 各不同；C 不含 source scope）
 * - 凭据负路径：无 Authorization → 401 API_KEY_MISSING；错误 key → 401
 *   API_KEY_INVALID；scope 缺失 → 403 API_KEY_SCOPE_DENIED
 * - bind（活动 A）：201；重复同 body → 201 deduplicated:true 同 mappingId；同幂等
 *   键异 payload → 409 SOURCE_MAPPING_CONFLICT；同活动换来源对象 → 409；CP 受控
 *   字段/未知字段 → 400；edition 不属于 programme → 409
 * - 跨 Programme 隔离：B 客户端对 A 的 sourceObjectId apply/publish/cancel、以及
 *   抢占绑定 A 已接入的活动 → 404 SOURCE_MAPPING_NOT_FOUND
 * - apply（活动 A）v1：200 applied:true；prisma 直查活动字段已更新（startTime 落
 *   Date）；同版同内容 → applied:false；同版异内容 → 409；v3 后 v2 → 409 STALE；
 *   白名单外字段 → 400；受控字段（status）→ 400 且活动未被改动；审计落库
 * - CP 编辑守卫：已映射活动 PATCH 权威字段 title → 409
 *   ACTIVITY_SOURCE_FIELD_CONFLICT；PATCH 非权威字段 coverImage → 200；未映射
 *   活动 PATCH title → 200（行为不变）
 * - 报名门：已映射未发布活动 A → 409 ACTIVITY_SOURCE_NOT_PUBLISHED
 * - publish（活动 B）v1：201；同内容重发 deduplicated:true；同版本异 projectionJson
 *   → 409 PUBLICATION_CONFLICT；非整数 sourceVersion → 400；outbound_dispatch 有
 *   publication.published 行且 payload 无 projectionJson 正文（marker 断言）
 * - publish v2 → 201 后管理端代报名 → 201（不再因未发布被拒）
 * - cancel（活动 B）：200 cancelled:true withdrawnVersions 含 1、2；活动
 *   status=CANCELLED；outbound_dispatch 有 publication.withdrawn 与
 *   activity.cancelled 行；再 cancel → cancelled:false withdrawnVersions:[]；
 *   报名 → 409 ACTIVITY_SOURCE_CANCELLED；对已撤回版本再 publish →
 *   409 PUBLICATION_RESTORE_FORBIDDEN
 * - 管理端：匿名 GET → 401 JSON（后台接口鉴权迁移第 1 批）；ADMIN
 *   GET → 200 且含所建映射，programme 过滤隔离
 * - 审计：source_mapping.bind/apply/publish/cancel 落 core_audit_logs
 *
 * 注：apply 版本序与 publish 版本序在同一映射上互斥（publish 拒绝比已应用更旧的
 * 来源版本），故矩阵拆到两条映射/两个活动上执行。
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
const runStartedAt = new Date();

const markerV1 = `SRC_MARKER_V1_${suffix}`;
const markerV2 = `SRC_MARKER_V2_${suffix}`;

const sourceObjectA = `src-activity-a-${suffix}`;
const sourceObjectB = `src-activity-b-${suffix}`;
const sourceEditionRef = `src-edition-${suffix}`;

let serverReady = false;
let prisma: PrismaClient | null = null;

const adminClient = new ApiClient(baseURL);
const applicantClient = new ApiClient(baseURL);
const machineClient = new ApiClient(baseURL);

const state: {
  programmeAId?: string;
  programmeBId?: string;
  editionAId?: string;
  editionBId?: string;
  clientAId?: string;
  clientAKey?: string;
  machineKeyA?: string;
  clientBId?: string;
  clientBKey?: string;
  machineKeyB?: string;
  clientCKey?: string;
  machineKeyC?: string;
  activityMappedId?: string;
  activityPublishId?: string;
  activityUnmappedId?: string;
  applicantUserId?: string;
  mappingAId?: string;
  mappingBId?: string;
  publicationV1Id?: string;
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

/** Open API 错误 envelope 是 {error:{code,message,requestId}}；内部接口仍是平面 {error,code}。 */
function asError(data: unknown) {
  return (data as { error?: { code?: string; message?: string } }).error ?? {};
}

function bindBody(overrides: Record<string, unknown> = {}) {
  return {
    sourceEditionRef,
    sourceObjectId: sourceObjectA,
    activityId: state.activityMappedId,
    editionId: state.editionAId,
    authoritativeFields: ["title", "titleEn", "startTime", "summary"],
    idempotencyKey: `src-bind-${suffix}`,
    ...overrides,
  };
}

function revisionBody(sourceObjectId: string, sourceVersion: string, fields: Record<string, unknown>, idempotencyKey: string) {
  return { sourceObjectId, sourceEditionRef, sourceVersion, fields, idempotencyKey };
}

function publishBody(sourceObjectId: string, sourceVersion: string, projectionJson: Record<string, unknown>, idempotencyKey: string) {
  return { sourceObjectId, sourceEditionRef, sourceVersion, projectionJson, idempotencyKey };
}

function cancelBody(sourceObjectId: string, idempotencyKey: string) {
  return { sourceObjectId, sourceEditionRef, reason: "source test cancellation", idempotencyKey };
}

async function createActivity(client: PrismaClient, title: string, slugPart: string, adminUserId: string) {
  const activity = await client.activity.create({
    data: {
      type: "EVENT",
      title,
      titleEn: title,
      slug: `${slugPart}-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 60),
      status: "PUBLISHED",
      language: "en",
      createdByUserId: adminUserId,
      organizerUserId: adminUserId,
      startTime: new Date("2026-12-01T09:00:00.000Z"),
      endTime: new Date("2026-12-01T12:00:00.000Z"),
    },
    select: { id: true },
  });
  return activity.id;
}

before(async () => {
  serverReady = await waitForServer(baseURL, 30000);
});

describe("正式活动来源映射执行层（CP-TODO-245）", () => {
  test("准备：账号/活动/三 MACHINE 客户端（A、B 含 source scope，C 不含）", async (t) => {
    skipUnlessReady(t);
    const seeded = testData.seededUsers;
    const login = await adminClient.login(buildLoginPayload(locale, seeded.admin.email, "seeded-password"));
    assert.equal(login.status, 200, `管理员登录失败: ${JSON.stringify(login.data)}`);

    const client = await db();
    const passwordHash = await hash("seeded-password", 10);
    const applicantEmail = `src_applicant_${suffix}@example.com`;
    const applicant = await client.user.create({
      data: {
        email: applicantEmail,
        name: "Source Applicant",
        password: passwordHash,
        role: "ATTENDEE",
        emailVerified: new Date(),
      },
      select: { id: true },
    });
    state.applicantUserId = applicant.id;
    const applicantLogin = await applicantClient.login(buildLoginPayload(locale, applicantEmail, "seeded-password"));
    assert.equal(applicantLogin.status, 200, `applicant 登录失败: ${JSON.stringify(applicantLogin.data)}`);

    const adminUser = await client.user.findUniqueOrThrow({ where: { email: seeded.admin.email }, select: { id: true } });

    const tenant = await client.tenant.create({
      data: { key: `src-tenant-${suffix}`, name: `Source Tenant ${suffix}` },
      select: { id: true },
    });
    const programmeA = await client.programme.create({
      data: { key: `src-prog-a-${suffix}`, name: `Source Programme A ${suffix}`, tenantId: tenant.id },
      select: { id: true },
    });
    const programmeB = await client.programme.create({
      data: { key: `src-prog-b-${suffix}`, name: `Source Programme B ${suffix}`, tenantId: tenant.id },
      select: { id: true },
    });
    state.programmeAId = programmeA.id;
    state.programmeBId = programmeB.id;

    const editionA = await client.edition.create({
      data: { programmeId: programmeA.id, key: `src-ed-a-${suffix}`, name: `Source Edition A ${suffix}` },
      select: { id: true },
    });
    const editionB = await client.edition.create({
      data: { programmeId: programmeB.id, key: `src-ed-b-${suffix}`, name: `Source Edition B ${suffix}` },
      select: { id: true },
    });
    state.editionAId = editionA.id;
    state.editionBId = editionB.id;

    state.activityMappedId = await createActivity(client, `Source Mapped Activity ${suffix}`, "src-mapped", adminUser.id);
    state.activityPublishId = await createActivity(client, `Source Publish Activity ${suffix}`, "src-publish", adminUser.id);
    state.activityUnmappedId = await createActivity(client, `Source Unmapped Activity ${suffix}`, "src-unmapped", adminUser.id);

    const registerA = await adminClient.post("/api/admin/channel-clients", {
      displayName: `Source Client A ${suffix}`,
      type: "MACHINE",
      programmeId: programmeA.id,
      allowedOrigins: [],
      allowedScopes: ["channel:activities:source", "dispatch:publications"],
      machineKey: `cpmk_src_a_${suffix}`,
      callbackUrl: "http://127.0.0.1:9/hook",
    });
    assert.equal(registerA.status, 201, `登记客户端 A 失败: ${JSON.stringify(registerA.data)}`);
    const bodyA = registerA.data as { client: { id: string; key: string }; machineKey?: string };
    state.clientAId = bodyA.client.id;
    state.clientAKey = bodyA.client.key;
    state.machineKeyA = bodyA.machineKey;

    const registerB = await adminClient.post("/api/admin/channel-clients", {
      displayName: `Source Client B ${suffix}`,
      type: "MACHINE",
      programmeId: programmeB.id,
      allowedOrigins: [],
      allowedScopes: ["channel:activities:source", "dispatch:publications"],
      machineKey: `cpmk_src_b_${suffix}`,
      callbackUrl: "http://127.0.0.1:9/hook",
    });
    assert.equal(registerB.status, 201, `登记客户端 B 失败: ${JSON.stringify(registerB.data)}`);
    const bodyB = registerB.data as { client: { id: string; key: string }; machineKey?: string };
    state.clientBId = bodyB.client.id;
    state.clientBKey = bodyB.client.key;
    state.machineKeyB = bodyB.machineKey;

    const registerC = await adminClient.post("/api/admin/channel-clients", {
      displayName: `Source Client C ${suffix}`,
      type: "MACHINE",
      programmeId: programmeA.id,
      allowedOrigins: [],
      allowedScopes: ["channel:certificates:verify"],
      machineKey: `cpmk_src_c_${suffix}`,
    });
    assert.equal(registerC.status, 201, `登记客户端 C 失败: ${JSON.stringify(registerC.data)}`);
    const bodyC = registerC.data as { client: { key: string }; machineKey?: string };
    state.clientCKey = bodyC.client.key;
    state.machineKeyC = bodyC.machineKey;
  });

  test("凭据负路径：无 Authorization/错误 key 401，缺 scope 403", async (t) => {
    skipUnlessReady(t);

    const noHeaders = await machineClient.post("/api/v1/open/activity-mappings", bindBody());
    assert.equal(noHeaders.status, 401);
    assert.equal(asError(noHeaders.data).code, "API_KEY_MISSING");

    const wrongKey = await machineClient.post(
      "/api/v1/open/activity-mappings",
      bindBody(),
      openBearer(state.clientAKey!, "wrong-machine-key"),
    );
    assert.equal(wrongKey.status, 401);
    assert.equal(asError(wrongKey.data).code, "API_KEY_INVALID");

    const scopeDenied = await machineClient.post(
      "/api/v1/open/activity-mappings",
      bindBody(),
      openBearer(state.clientCKey!, state.machineKeyC!),
    );
    assert.equal(scopeDenied.status, 403);
    assert.equal(asError(scopeDenied.data).code, "API_KEY_SCOPE_DENIED");
  });

  test("bind（活动 A）：201、幂等去重、幂等键冲突、同活动换来源对象、白名单与 edition 校验", async (t) => {
    skipUnlessReady(t);

    const bind = await machineClient.post(
      "/api/v1/open/activity-mappings",
      bindBody(),
      openBearer(state.clientAKey!, state.machineKeyA!),
    );
    assert.equal(bind.status, 201, `bind 失败: ${JSON.stringify(bind.data)}`);
    const bindData = bind.data as { mappingId: string; deduplicated: boolean };
    assert.equal(bindData.deduplicated, false);
    assert.ok(bindData.mappingId, "应返回 mappingId");
    state.mappingAId = bindData.mappingId;

    const replay = await machineClient.post(
      "/api/v1/open/activity-mappings",
      bindBody(),
      openBearer(state.clientAKey!, state.machineKeyA!),
    );
    assert.equal(replay.status, 201, `重复 bind 必须幂等: ${JSON.stringify(replay.data)}`);
    assert.equal((replay.data as { deduplicated: boolean }).deduplicated, true);
    assert.equal((replay.data as { mappingId: string }).mappingId, state.mappingAId, "去重应返回同一 mappingId");

    const keyConflict = await machineClient.post(
      "/api/v1/open/activity-mappings",
      bindBody({ sourceObjectId: `src-activity-other-${suffix}` }),
      openBearer(state.clientAKey!, state.machineKeyA!),
    );
    assert.equal(keyConflict.status, 409, "同幂等键异内容必须 409");
    assert.equal(asError(keyConflict.data).code, "SOURCE_MAPPING_CONFLICT");

    const secondSource = await machineClient.post(
      "/api/v1/open/activity-mappings",
      bindBody({ idempotencyKey: `src-bind-2-${suffix}`, sourceObjectId: `src-activity-2-${suffix}` }),
      openBearer(state.clientAKey!, state.machineKeyA!),
    );
    assert.equal(secondSource.status, 409, "同活动绑第二个来源对象必须 409");
    assert.equal(asError(secondSource.data).code, "SOURCE_MAPPING_CONFLICT");

    const controlledField = await machineClient.post(
      "/api/v1/open/activity-mappings",
      bindBody({ idempotencyKey: `src-bind-3-${suffix}`, sourceObjectId: `src-activity-3-${suffix}`, authoritativeFields: ["title", "status"] }),
      openBearer(state.clientAKey!, state.machineKeyA!),
    );
    assert.equal(controlledField.status, 400, "CP 受控字段入白名单必须 400");

    const unknownField = await machineClient.post(
      "/api/v1/open/activity-mappings",
      bindBody({ idempotencyKey: `src-bind-4-${suffix}`, sourceObjectId: `src-activity-4-${suffix}`, authoritativeFields: ["title", "notAColumn"] }),
      openBearer(state.clientAKey!, state.machineKeyA!),
    );
    assert.equal(unknownField.status, 400, "未知 Activity 列必须 400");

    const wrongEdition = await machineClient.post(
      "/api/v1/open/activity-mappings",
      bindBody({ idempotencyKey: `src-bind-5-${suffix}`, sourceObjectId: `src-activity-5-${suffix}`, editionId: state.editionBId }),
      openBearer(state.clientAKey!, state.machineKeyA!),
    );
    assert.equal(wrongEdition.status, 409, "edition 不属于认证 programme 必须 409");

    const client = await db();
    const mapping = await client.sourceObjectMapping.findUniqueOrThrow({ where: { id: state.mappingAId } });
    assert.equal(mapping.applyStatus, "ACTIVE");
    assert.equal(mapping.sourceSystem, state.clientAKey, "sourceSystem 应为登记客户端 key");
    assert.equal(mapping.programmeId, state.programmeAId);
    assert.equal(mapping.activityId, state.activityMappedId);
    assert.ok(mapping.contentHash, "contentHash 必须落库");

    const audit = await client.coreAuditLog.findFirst({
      where: { action: "source_mapping.bind", subjectId: state.activityMappedId, createdAt: { gte: runStartedAt } },
    });
    assert.ok(audit, "bind 审计必须落库");
  });

  test("跨 Programme 隔离：B 客户端对 A 的对象寻址与抢占绑定一律 404", async (t) => {
    skipUnlessReady(t);
    const headers = openBearer(state.clientBKey!, state.machineKeyB!);

    const apply = await machineClient.post(
      "/api/v1/open/activity-mappings/revisions",
      revisionBody(sourceObjectA, "1", { title: `Cross tenant write ${suffix}` }, `src-x-apply-${suffix}`),
      headers,
    );
    assert.equal(apply.status, 404);
    assert.equal(asError(apply.data).code, "SOURCE_MAPPING_NOT_FOUND");

    const publish = await machineClient.post(
      "/api/v1/open/activity-mappings/publish",
      publishBody(sourceObjectA, "1", { title: "Cross tenant publish" }, `src-x-pub-${suffix}`),
      headers,
    );
    assert.equal(publish.status, 404);
    assert.equal(asError(publish.data).code, "SOURCE_MAPPING_NOT_FOUND");

    const cancel = await machineClient.post(
      "/api/v1/open/activity-mappings/cancel",
      cancelBody(sourceObjectA, `src-x-cancel-${suffix}`),
      headers,
    );
    assert.equal(cancel.status, 404);
    assert.equal(asError(cancel.data).code, "SOURCE_MAPPING_NOT_FOUND");

    // 抢占绑定同样不行：A 已接入别的 Programme，B 连"这个活动存在"都问不出来。
    const preempt = await machineClient.post(
      "/api/v1/open/activity-mappings",
      {
        sourceObjectId: `src-preempt-${suffix}`,
        activityId: state.activityMappedId,
        authoritativeFields: ["title"],
        idempotencyKey: `src-preempt-${suffix}`,
      },
      headers,
    );
    assert.equal(preempt.status, 404, `跨 Programme 抢占绑定必须 404: ${JSON.stringify(preempt.data)}`);
    assert.equal(asError(preempt.data).code, "SOURCE_MAPPING_NOT_FOUND");
  });

  test("apply v1（活动 A）：200 applied:true，活动字段与映射版本落库，审计写入", async (t) => {
    skipUnlessReady(t);
    const headers = openBearer(state.clientAKey!, state.machineKeyA!);
    const apply = await machineClient.post(
      "/api/v1/open/activity-mappings/revisions",
      revisionBody(sourceObjectA, "1", { title: `Source Applied v1 ${suffix}`, startTime: "2026-11-01T09:00:00.000Z" }, `src-apply-1-${suffix}`),
      headers,
    );
    assert.equal(apply.status, 200, `apply v1 失败: ${JSON.stringify(apply.data)}`);
    assert.equal((apply.data as { applied: boolean }).applied, true);
    assert.equal((apply.data as { mappingId: string }).mappingId, state.mappingAId);

    const client = await db();
    const activity = await client.activity.findUniqueOrThrow({ where: { id: state.activityMappedId } });
    assert.equal(activity.title, `Source Applied v1 ${suffix}`, "来源白名字段必须落库");
    assert.equal(activity.startTime?.toISOString(), "2026-11-01T09:00:00.000Z", "startTime 必须按 Date 落库");

    const mapping = await client.sourceObjectMapping.findUniqueOrThrow({ where: { id: state.mappingAId } });
    assert.equal(mapping.sourceVersion, "1");

    const audit = await client.coreAuditLog.findFirst({
      where: { action: "source_mapping.apply", subjectId: state.activityMappedId, createdAt: { gte: runStartedAt } },
    });
    assert.ok(audit, "apply 审计必须落库");
  });

  test("CP 编辑守卫：权威字段 409，非权威字段 200，未映射活动行为不变", async (t) => {
    skipUnlessReady(t);

    const ownedConflict = await adminClient.patch(`/api/activities/${state.activityMappedId}`, {
      title: `CP edit attempt ${suffix}`,
    });
    assert.equal(ownedConflict.status, 409, `权威字段必须 409: ${JSON.stringify(ownedConflict.data)}`);
    assert.equal((ownedConflict.data as { code?: string }).code, "ACTIVITY_SOURCE_FIELD_CONFLICT");

    const coverImage = `https://img.example/cover-${suffix}.png`;
    const nonOwned = await adminClient.patch(`/api/activities/${state.activityMappedId}`, { coverImage });
    assert.equal(nonOwned.status, 200, `非权威字段必须可编辑: ${JSON.stringify(nonOwned.data)}`);
    const client = await db();
    const mapped = await client.activity.findUniqueOrThrow({ where: { id: state.activityMappedId } });
    assert.equal(mapped.coverImage, coverImage, "非权威字段编辑必须落库");
    assert.equal(mapped.title, `Source Applied v1 ${suffix}`, "409 守卫不得改动活动");

    const unmappedTitle = `Unmapped CP edit ${suffix}`;
    const unmapped = await adminClient.patch(`/api/activities/${state.activityUnmappedId}`, { title: unmappedTitle });
    assert.equal(unmapped.status, 200, `未映射活动 PATCH title 必须 200: ${JSON.stringify(unmapped.data)}`);
    const unmappedRow = await client.activity.findUniqueOrThrow({ where: { id: state.activityUnmappedId } });
    assert.equal(unmappedRow.title, unmappedTitle, "未映射活动行为不变");
  });

  test("apply 版本序与白名单（活动 A）：幂等/同版异内容 409/v3 后 v2 STALE/白名单外与受控字段 400", async (t) => {
    skipUnlessReady(t);
    const headers = openBearer(state.clientAKey!, state.machineKeyA!);
    const applyV1Fields = { title: `Source Applied v1 ${suffix}`, startTime: "2026-11-01T09:00:00.000Z" };

    const replay = await machineClient.post(
      "/api/v1/open/activity-mappings/revisions",
      revisionBody(sourceObjectA, "1", applyV1Fields, `src-apply-1-${suffix}`),
      headers,
    );
    assert.equal(replay.status, 200, `同版同内容必须幂等: ${JSON.stringify(replay.data)}`);
    assert.equal((replay.data as { applied: boolean }).applied, false);

    const conflict = await machineClient.post(
      "/api/v1/open/activity-mappings/revisions",
      revisionBody(sourceObjectA, "1", { title: `Tampered v1 ${suffix}` }, `src-apply-1b-${suffix}`),
      headers,
    );
    assert.equal(conflict.status, 409, "同版本异内容必须 409");
    assert.equal(asError(conflict.data).code, "SOURCE_MAPPING_CONFLICT");

    const v3 = await machineClient.post(
      "/api/v1/open/activity-mappings/revisions",
      revisionBody(sourceObjectA, "3", { title: `Source Applied v3 ${suffix}` }, `src-apply-3-${suffix}`),
      headers,
    );
    assert.equal(v3.status, 200, `apply v3 失败: ${JSON.stringify(v3.data)}`);
    assert.equal((v3.data as { applied: boolean }).applied, true);

    const stale = await machineClient.post(
      "/api/v1/open/activity-mappings/revisions",
      revisionBody(sourceObjectA, "2", { title: `Rollback v2 ${suffix}` }, `src-apply-2-${suffix}`),
      headers,
    );
    assert.equal(stale.status, 409, "已应用 v3 后 v2 必须 409");
    assert.equal(asError(stale.data).code, "SOURCE_MAPPING_STALE");

    const offWhitelist = await machineClient.post(
      "/api/v1/open/activity-mappings/revisions",
      revisionBody(sourceObjectA, "4", { capacity: 10 }, `src-apply-4-${suffix}`),
      headers,
    );
    assert.equal(offWhitelist.status, 400, "白名单外字段必须 400");

    const controlled = await machineClient.post(
      "/api/v1/open/activity-mappings/revisions",
      revisionBody(sourceObjectA, "4", { status: "DRAFT" }, `src-apply-4b-${suffix}`),
      headers,
    );
    assert.equal(controlled.status, 400, "CP 受控字段必须 400");

    const client = await db();
    const activity = await client.activity.findUniqueOrThrow({ where: { id: state.activityMappedId } });
    assert.equal(activity.title, `Source Applied v3 ${suffix}`, "409/400 不得改动活动");
    assert.equal(activity.status, "PUBLISHED", "受控字段不得经来源改写");
  });

  test("报名门：已映射未发布活动 A 409 ACTIVITY_SOURCE_NOT_PUBLISHED", async (t) => {
    skipUnlessReady(t);
    const apply = await applicantClient.post("/api/activity-applications", {
      activityId: state.activityMappedId,
      userId: state.applicantUserId,
    });
    assert.equal(apply.status, 409, `未发布映射活动报名必须 409: ${JSON.stringify(apply.data)}`);
    assert.equal((apply.data as { code?: string }).code, "ACTIVITY_SOURCE_NOT_PUBLISHED");
  });

  test("publish（活动 B）v1：201、去重、冲突、版本校验、扇出 payload 无正文", async (t) => {
    skipUnlessReady(t);
    const headers = openBearer(state.clientAKey!, state.machineKeyA!);

    const bindB = await machineClient.post(
      "/api/v1/open/activity-mappings",
      bindBody({
        sourceObjectId: sourceObjectB,
        activityId: state.activityPublishId,
        idempotencyKey: `src-bind-b-${suffix}`,
      }),
      headers,
    );
    assert.equal(bindB.status, 201, `bind 活动 B 失败: ${JSON.stringify(bindB.data)}`);
    state.mappingBId = (bindB.data as { mappingId: string }).mappingId;

    const projectionV1 = { title: `Source Public v1 ${suffix}`, marker: markerV1 };
    const publish = await machineClient.post(
      "/api/v1/open/activity-mappings/publish",
      publishBody(sourceObjectB, "1", projectionV1, `src-pub-1-${suffix}`),
      headers,
    );
    assert.equal(publish.status, 201, `publish v1 失败: ${JSON.stringify(publish.data)}`);
    assert.equal((publish.data as { deduplicated: boolean }).deduplicated, false);
    assert.ok((publish.data as { publicationId: string }).publicationId);
    state.publicationV1Id = (publish.data as { publicationId: string }).publicationId;

    const replay = await machineClient.post(
      "/api/v1/open/activity-mappings/publish",
      publishBody(sourceObjectB, "1", { marker: markerV1, title: `Source Public v1 ${suffix}` }, `src-pub-1b-${suffix}`),
      headers,
    );
    assert.equal(replay.status, 201, `同内容重发必须幂等: ${JSON.stringify(replay.data)}`);
    assert.equal((replay.data as { deduplicated: boolean }).deduplicated, true);
    assert.equal((replay.data as { publicationId: string }).publicationId, state.publicationV1Id);

    const conflict = await machineClient.post(
      "/api/v1/open/activity-mappings/publish",
      publishBody(sourceObjectB, "1", { title: "Tampered projection", marker: "TAMPERED" }, `src-pub-1c-${suffix}`),
      headers,
    );
    assert.equal(conflict.status, 409, "同版本异 projectionJson 必须 409");
    assert.equal(asError(conflict.data).code, "PUBLICATION_CONFLICT");

    const badVersion = await machineClient.post(
      "/api/v1/open/activity-mappings/publish",
      publishBody(sourceObjectB, "1.5", { title: "Bad version" }, `src-pub-1d-${suffix}`),
      headers,
    );
    assert.equal(badVersion.status, 400, "非正整数 sourceVersion 必须 400");

    const client = await db();
    const dispatches = await client.outboundDispatch.findMany({
      where: {
        eventType: "publication.published",
        channelClientId: { in: [state.clientAId!, state.clientBId!] },
        payloadJson: { path: ["objectId"], equals: state.activityPublishId },
      },
    });
    assert.ok(dispatches.length >= 2, "A/B 订阅者都应收到 published 事件");
    for (const row of dispatches) {
      const payload = row.payloadJson as Record<string, unknown>;
      assert.equal(payload.objectType, "activity");
      assert.equal(payload.version, 1);
      assert.equal(typeof payload.projectionHash, "string", "payload 只含定位级字段与投影哈希");
      assert.equal("projectionJson" in payload, false, "payload 不得含 projectionJson 正文");
      assert.equal(JSON.stringify(row.payloadJson).includes(markerV1), false, "payload 不得泄漏投影正文");
    }

    const audit = await client.coreAuditLog.findFirst({
      where: { action: "source_mapping.publish", subjectId: state.activityPublishId, createdAt: { gte: runStartedAt } },
    });
    assert.ok(audit, "publish 审计必须落库");
  });

  test("publish v2（活动 B）→ 201 后管理端代报名 → 201（不再因未发布被拒）", async (t) => {
    skipUnlessReady(t);
    const publishV2 = await machineClient.post(
      "/api/v1/open/activity-mappings/publish",
      publishBody(sourceObjectB, "2", { title: `Source Public v2 ${suffix}`, marker: markerV2 }, `src-pub-2-${suffix}`),
      openBearer(state.clientAKey!, state.machineKeyA!),
    );
    assert.equal(publishV2.status, 201, `publish v2 失败: ${JSON.stringify(publishV2.data)}`);

    const apply = await adminClient.post("/api/activity-applications", {
      activityId: state.activityPublishId,
      userId: state.applicantUserId,
    });
    assert.equal(apply.status, 201, `已发布映射活动报名必须放行: ${JSON.stringify(apply.data)}`);
  });

  test("cancel（活动 B）：撤回全部版本+取消活动+扇出，幂等，报名 409，撤回版本禁止复活", async (t) => {
    skipUnlessReady(t);
    const headers = openBearer(state.clientAKey!, state.machineKeyA!);

    const cancel = await machineClient.post(
      "/api/v1/open/activity-mappings/cancel",
      cancelBody(sourceObjectB, `src-cancel-${suffix}`),
      headers,
    );
    assert.equal(cancel.status, 200, `cancel 失败: ${JSON.stringify(cancel.data)}`);
    const cancelData = cancel.data as { activityId: string; cancelled: boolean; withdrawnVersions: number[] };
    assert.equal(cancelData.cancelled, true);
    assert.deepEqual([...cancelData.withdrawnVersions].sort(), [1, 2], "应撤回 v1 与 v2");

    const client = await db();
    const activity = await client.activity.findUniqueOrThrow({ where: { id: state.activityPublishId } });
    assert.equal(activity.status, "CANCELLED", "cancel 必须优先关闭入口（活动 CANCELLED）");

    const withdrawn = await client.outboundDispatch.findMany({
      where: {
        eventType: "publication.withdrawn",
        channelClientId: state.clientAId,
        payloadJson: { path: ["objectId"], equals: state.activityPublishId },
      },
    });
    assert.equal(withdrawn.length, 2, "A 订阅者应收到 v1/v2 两条 withdrawn 事件");
    for (const row of withdrawn) {
      const payload = row.payloadJson as Record<string, unknown>;
      assert.equal(payload.status, "WITHDRAWN");
      assert.equal([1, 2].includes(payload.version as number), true);
      const raw = JSON.stringify(row.payloadJson);
      assert.equal(raw.includes(markerV1) || raw.includes(markerV2), false, "withdrawn payload 不得泄漏投影正文");
    }

    const cancelledEvent = await client.outboundDispatch.findFirst({
      where: {
        eventType: "activity.cancelled",
        channelClientId: state.clientAId,
        payloadJson: { path: ["objectId"], equals: state.activityPublishId },
      },
    });
    assert.ok(cancelledEvent, "必须扇出 activity.cancelled 定位事件");
    assert.equal((cancelledEvent.payloadJson as { status: string }).status, "CANCELLED");

    const audit = await client.coreAuditLog.findFirst({
      where: { action: "source_mapping.cancel", subjectId: state.activityPublishId, createdAt: { gte: runStartedAt } },
    });
    assert.ok(audit, "cancel 审计必须落库");

    const replay = await machineClient.post(
      "/api/v1/open/activity-mappings/cancel",
      cancelBody(sourceObjectB, `src-cancel-2-${suffix}`),
      headers,
    );
    assert.equal(replay.status, 200, `重复 cancel 必须 200: ${JSON.stringify(replay.data)}`);
    assert.equal((replay.data as { cancelled: boolean }).cancelled, false);
    assert.deepEqual((replay.data as { withdrawnVersions: number[] }).withdrawnVersions, []);

    const applyAfterCancel = await applicantClient.post("/api/activity-applications", {
      activityId: state.activityPublishId,
      userId: state.applicantUserId,
    });
    assert.equal(applyAfterCancel.status, 409, `已取消活动报名必须 409: ${JSON.stringify(applyAfterCancel.data)}`);
    assert.equal((applyAfterCancel.data as { code?: string }).code, "ACTIVITY_SOURCE_CANCELLED");

    const restore = await machineClient.post(
      "/api/v1/open/activity-mappings/publish",
      publishBody(sourceObjectB, "1", { title: `Source Public v1 ${suffix}`, marker: markerV1 }, `src-pub-restore-${suffix}`),
      headers,
    );
    assert.equal(restore.status, 409, "对已撤回版本再发布必须 409");
    assert.equal(asError(restore.data).code, "PUBLICATION_RESTORE_FORBIDDEN");
  });

  test("管理端列表：匿名 401 JSON，ADMIN 200 且含所建映射，programme 过滤隔离", async (t) => {
    skipUnlessReady(t);

    // 后台 JSON 路由已改用 requireApiRole：鉴权失败返回 401 JSON，不再重定向到登录页。
    const anonymousResponse = await fetch(`${baseURL}/api/admin/activity-mappings`, { redirect: "manual" });
    assert.equal(anonymousResponse.status, 401, `匿名访问必须 401: ${anonymousResponse.status}`);
    assert.ok(anonymousResponse.headers.get("content-type")?.includes("application/json"), "匿名鉴权失败必须返回 JSON");
    assert.equal((await anonymousResponse.json()).error, "Authentication required.");

    const admin = await adminClient.get(`/api/admin/activity-mappings?activityId=${state.activityMappedId}`);
    assert.equal(admin.status, 200, `ADMIN 列表失败: ${JSON.stringify(admin.data)}`);
    const mappings = (admin.data as { mappings: Array<{ id: string; sourceSystem: string }> }).mappings;
    const found = mappings.find((row) => row.id === state.mappingAId);
    assert.ok(found, "列表应含活动 A 的映射");
    assert.equal(found.sourceSystem, state.clientAKey);

    // 映射的 programme 取自认证客户端：A/B 两条映射都属于 programme A（B 客户端从未 bind）。
    const programmeAList = await adminClient.get(`/api/admin/activity-mappings?programmeId=${state.programmeAId}`);
    assert.equal(programmeAList.status, 200);
    const aMappings = (programmeAList.data as { mappings: Array<{ id: string }> }).mappings;
    assert.equal(aMappings.some((row) => row.id === state.mappingAId), true, "programme A 列表应含活动 A 的映射");
    assert.equal(aMappings.some((row) => row.id === state.mappingBId), true, "programme A 列表应含活动 B 的映射");

    const programmeBList = await adminClient.get(`/api/admin/activity-mappings?programmeId=${state.programmeBId}`);
    assert.equal(programmeBList.status, 200);
    const bMappings = (programmeBList.data as { mappings: Array<{ id: string }> }).mappings;
    assert.equal(bMappings.some((row) => row.id === state.mappingAId), false, "programme 过滤不得泄漏 A 的映射");
    assert.equal(bMappings.some((row) => row.id === state.mappingBId), false, "programme 过滤不得泄漏 B 的映射");
  });

  test("审计：bind/apply/publish/cancel 全部落库", async (t) => {
    skipUnlessReady(t);
    const client = await db();

    const auditsA = await client.coreAuditLog.findMany({
      where: {
        createdAt: { gte: runStartedAt },
        action: { in: ["source_mapping.bind", "source_mapping.apply"] },
        subjectId: state.activityMappedId,
      },
    });
    const actionsA = new Set(auditsA.map((audit) => audit.action));
    assert.equal(actionsA.has("source_mapping.bind"), true, "活动 A 缺少 bind 审计");
    assert.equal(actionsA.has("source_mapping.apply"), true, "活动 A 缺少 apply 审计");

    const auditsB = await client.coreAuditLog.findMany({
      where: {
        createdAt: { gte: runStartedAt },
        action: { in: ["source_mapping.bind", "source_mapping.publish", "source_mapping.cancel"] },
        subjectId: state.activityPublishId,
      },
    });
    const actionsB = new Set(auditsB.map((audit) => audit.action));
    for (const action of ["source_mapping.bind", "source_mapping.publish", "source_mapping.cancel"]) {
      assert.equal(actionsB.has(action), true, `活动 B 缺少审计动作 ${action}`);
    }
  });
});
