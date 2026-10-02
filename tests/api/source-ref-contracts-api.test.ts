// see docs/CURRENT_IMPLEMENTATION_STATUS.md
/**
 * API 集成测试：通用 sourceRef 契约与 FS（Future Stewards）接入示例（CP-TODO-252 / CP-FR-071）
 *
 * 覆盖矩阵（真实数据库 + 真实 API Key 鉴权；FS 侧由本文件模拟）：
 * - 准备：ADMIN 登录；两个 Programme；FS MACHINE 客户端（A Programme，scope
 *   channel:source:resolve）、缺该 scope 的客户端（A）、外来客户端（B Programme，同 scope）；
 *   创建 Person / Institution / Activity / ScopedRecord，并把后三者接入 A Programme
 * - 主流程：FS 用 bearer API Key 解析四类对象 → 200，contracts SourceRefResolveResponseSchema
 *   校验通过，schemaRef 为 cp.{object}/v1 系列，locator 可用，contentHash 64 位十六进制，
 *   投影白名单断言（person 无 bio/orcid、institution 无法名/联系邮箱、
 *   activity 无组织者账号、record 无正文）
 * - 多 Programme 隔离：B Programme 的 key 解析 A 的 institution/activity/record 一律
 *   404（与不存在同形）；person 是全局身份，B 也能解析
 * - 负路径：无 Authorization 401 API_KEY_MISSING；缺 scope 403 API_KEY_SCOPE_DENIED；
 *   body 携带 system 400（调用方即来源系统，不接受代填）；未知 objectType 400；
 *   对象不存在 404；客户端停用后即刻 401
 * - 对账：同对象两次解析 contentHash 一致；source_ref.resolve 审计落库
 *
 * 运行方式：npm run test:api（隔离测试数据库 + 本地测试服务器）。
 */

import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { SourceRefResolveResponseSchema } from "@climate-passport/passport-contracts";
import { ApiClient, waitForServer } from "./_client";
import { buildLoginPayload, testData } from "../fixtures/test-data";

const baseURL = process.env.CP_TEST_BASE_URL || "http://localhost:3100";
const locale = testData.locale;
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

let serverReady = false;
let prisma: PrismaClient | null = null;

const adminClient = new ApiClient(baseURL);
const ownerClient = new ApiClient(baseURL);
const machineClient = new ApiClient(baseURL);

const RESOLVE_PATH = "/api/v1/open/source-refs/resolve";

type RegisteredKey = { clientKey: string; machineKey: string };

const state: {
  fs?: RegisteredKey;
  wrongScope?: RegisteredKey;
  foreign?: RegisteredKey;
  programmeId?: string;
  personId?: string;
  institutionId?: string;
  activityId?: string;
  recordId?: string;
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

/** Open API 只认 bearer：同一把登记密钥的对外形态是 `<clientKey>.<machineKey>`。 */
function bearer(who: RegisteredKey) {
  return { Authorization: `Bearer ${who.clientKey}.${who.machineKey}` };
}

function resolve(who: RegisteredKey, body: Record<string, unknown>) {
  return machineClient.post(RESOLVE_PATH, body, bearer(who));
}

function asError(data: unknown) {
  return (data as { error?: { code?: string; message?: string } }).error ?? {};
}

before(async () => {
  serverReady = await waitForServer(baseURL, 30000);
});

describe("通用 sourceRef 契约与 FS 接入示例（CP-TODO-252）", () => {
  test("准备：两个 Programme、三把 key 与已接入的对象", async (t) => {
    skipUnlessReady(t);
    const seeded = testData.seededUsers;
    const login = await adminClient.login(buildLoginPayload(locale, seeded.admin.email, "seeded-password"));
    assert.equal(login.status, 200, `管理员登录失败: ${JSON.stringify(login.data)}`);

    const client = await db();
    const adminUser = await client.user.findUniqueOrThrow({ where: { email: seeded.admin.email }, select: { id: true } });

    async function newProgramme(label: string) {
      const tenant = await client.tenant.create({ data: { key: `fs-tenant-${label}-${suffix}`, name: `FS Tenant ${suffix}` }, select: { id: true } });
      return client.programme.create({ data: { key: `fs-prog-${label}-${suffix}`, name: `FS Programme ${suffix}`, tenantId: tenant.id }, select: { id: true } });
    }
    const programmeA = await newProgramme("a");
    const programmeB = await newProgramme("b");
    state.programmeId = programmeA.id;

    async function registerKey(displayName: string, programmeId: string, machineKey: string, allowedScopes: string[]): Promise<RegisteredKey> {
      const registered = await adminClient.post("/api/admin/channel-clients", {
        displayName: `${displayName} ${suffix}`,
        type: "MACHINE",
        programmeId,
        allowedOrigins: [],
        allowedScopes,
        machineKey,
      });
      assert.equal(registered.status, 201, `${displayName} 登记失败: ${JSON.stringify(registered.data)}`);
      const body = registered.data as { client: { key: string }; machineKey?: string };
      assert.ok(body.machineKey, "登记必须回显一次性机器密钥");
      return { clientKey: body.client.key, machineKey: body.machineKey! };
    }

    state.fs = await registerKey("FS Lab System", programmeA.id, `cpmk_fs_${suffix}`, ["channel:source:resolve"]);
    state.wrongScope = await registerKey("Other System", programmeA.id, `cpmk_other_${suffix}`, ["channel:certificates:verify"]);
    state.foreign = await registerKey("Foreign System", programmeB.id, `cpmk_foreign_${suffix}`, ["channel:source:resolve"]);

    const person = await client.person.create({
      data: {
        displayName: `FS Person ${suffix}`,
        slug: `fs-person-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 50),
        bio: "私密 bio 不得进入投影",
        orcid: "0000-0002-XXXX-XXXX",
        verificationStatus: "VERIFIED",
      },
      select: { id: true },
    });
    state.personId = person.id;

    const institution = await client.institution.create({
      data: {
        slug: `fs-inst-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 50),
        name: `FS Institution ${suffix}`,
        shortName: "FSI",
        orgType: "lab",
        legalName: "私密法名不得进入投影",
        publicContactEmail: "secret@example.org",
      },
      select: { id: true },
    });
    state.institutionId = institution.id;

    const activity = await client.activity.create({
      data: {
        type: "EVENT",
        title: `FS Activity ${suffix}`,
        titleEn: `FS Activity ${suffix}`,
        slug: `fs-activity-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 60),
        status: "PUBLISHED",
        language: "en",
        createdByUserId: adminUser.id,
        organizerUserId: adminUser.id,
        startTime: new Date("2026-12-10T09:00:00.000Z"),
        endTime: new Date("2026-12-10T12:00:00.000Z"),
      },
      select: { id: true },
    });
    state.activityId = activity.id;

    const ownerEmail = `fs_owner_${suffix}@example.com`;
    await client.user.create({
      data: { email: ownerEmail, name: "FS Owner", password: await hash("seeded-password", 10), role: "ATTENDEE", emailVerified: new Date() },
      select: { id: true },
    });
    const ownerLogin = await ownerClient.login(buildLoginPayload(locale, ownerEmail, "seeded-password"));
    assert.equal(ownerLogin.status, 200);
    const record = await ownerClient.post("/api/records", {
      recordType: "fs_inquiry_draft",
      title: `FS Inquiry ${suffix}`,
      payloadJson: { question: "草稿正文不得进入投影" },
    });
    assert.equal(record.status, 201, `创建记录失败: ${JSON.stringify(record.data)}`);
    state.recordId = (record.data as { recordId: string }).recordId;

    // 对象归属 Programme：机构靠代表授权、活动靠来源映射、记录靠 programmeId 列。
    await client.institutionRepresentation.create({
      data: { institutionId: institution.id, userId: adminUser.id, programmeId: programmeA.id, actionScope: ["READ"], status: "ACTIVE" },
      select: { id: true },
    });
    await client.sourceObjectMapping.create({
      data: {
        programmeId: programmeA.id,
        sourceSystem: state.fs.clientKey,
        sourceObjectId: `fs-activity-${suffix}`,
        activityId: activity.id,
        applyStatus: "ACTIVE",
      },
      select: { id: true },
    });
    await client.scopedRecord.update({ where: { id: state.recordId! }, data: { programmeId: programmeA.id } });
  });

  test("FS 接入主流程：解析四类对象并按 schemaRef 校验投影", async (t) => {
    skipUnlessReady(t);

    const refs = [
      { objectType: "person", objectId: state.personId! },
      { objectType: "institution", objectId: state.institutionId! },
      { objectType: "activity", objectId: state.activityId! },
      { objectType: "record", objectId: state.recordId! },
    ];

    const responses = [];
    for (const ref of refs) {
      const response = await resolve(state.fs!, ref);
      assert.equal(response.status, 200, `解析 ${ref.objectType} 失败: ${JSON.stringify(response.data)}`);
      assert.match(response.headers.get("x-request-id") ?? "", /^[0-9a-f-]{36}$/, "响应必须带可关联的 x-request-id");
      const parsed = SourceRefResolveResponseSchema.safeParse(response.data);
      assert.ok(parsed.success, `响应必须符合 SourceRefResolveResponseSchema: ${JSON.stringify(response.data)}`);
      responses.push(parsed.data);
    }

    const [person, institution, activity, record] = responses;
    assert.equal(person.system, state.fs!.clientKey, "来源系统即调用方自己的 key");

    assert.equal(person.schemaRef, "cp.person_identity/v1");
    assert.equal(person.projection.displayName?.toString().includes("FS Person"), true);
    assert.equal(person.projection.verificationStatus, "VERIFIED");
    assert.equal(person.projection.bio, undefined, "person 投影无 bio");
    assert.equal(person.projection.orcid, undefined, "person 投影无 orcid");

    assert.equal(institution.schemaRef, "cp.institution_context/v1");
    assert.equal(institution.projection.shortName, "FSI");
    assert.equal(institution.projection.legalName, undefined, "institution 投影无法名");
    assert.equal(institution.projection.publicContactEmail, undefined, "institution 投影无联系邮箱");

    assert.equal(activity.schemaRef, "cp.activity_brief/v1");
    assert.equal(activity.projection.title?.toString().includes("FS Activity"), true);
    assert.equal(activity.projection.organizerUserId, undefined, "activity 投影无组织者账号");

    assert.equal(record.schemaRef, "cp.record_summary/v1");
    assert.equal(record.projection.recordType, "fs_inquiry_draft");
    assert.equal(record.projection.payloadJson, undefined, "record 投影无正文");

    for (const row of responses) {
      assert.match(row.contentHash, /^[a-f0-9]{64}$/);
      assert.equal(row.locator.startsWith("/"), true);
    }

    // 对账：同一对象两次解析，contentHash 一致（版本快照基础）
    const again = await resolve(state.fs!, refs[0]);
    assert.equal((again.data as { contentHash: string }).contentHash, person.contentHash);

    const client = await db();
    const audits = await client.coreAuditLog.count({ where: { action: "source_ref.resolve" } });
    assert.ok(audits >= 5, "解析审计落库（隔离库跨运行累积，只断言下限）");
  });

  test("多 Programme 隔离：外来 key 只读得到全局身份", async (t) => {
    skipUnlessReady(t);

    const objects = [
      { objectType: "institution", objectId: state.institutionId!, label: "机构" },
      { objectType: "activity", objectId: state.activityId!, label: "活动" },
      { objectType: "record", objectId: state.recordId!, label: "记录" },
    ];
    for (const item of objects) {
      const mine = await resolve(state.fs!, { objectType: item.objectType, objectId: item.objectId });
      assert.equal(mine.status, 200, `${item.label} 对本 Programme 可见`);

      const foreign = await resolve(state.foreign!, { objectType: item.objectType, objectId: item.objectId });
      assert.equal(foreign.status, 404, `${item.label} 不应对别的 Programme 可见`);
      assert.equal(asError(foreign.data).code, "SOURCE_REF_NOT_FOUND", "跨 Programme 与不存在同形，不确认 id 存在");
    }

    const person = await resolve(state.foreign!, { objectType: "person", objectId: state.personId! });
    assert.equal(person.status, 200, "person 是跨 Programme 的全局身份");
    assert.equal((person.data as { projection: Record<string, unknown> }).projection.bio, undefined);
  });

  test("负路径：凭据、scope、契约与对象不存在", async (t) => {
    skipUnlessReady(t);

    const noKey = await machineClient.post(RESOLVE_PATH, { objectType: "person", objectId: state.personId! });
    assert.equal(noKey.status, 401);
    assert.equal(asError(noKey.data).code, "API_KEY_MISSING");

    const wrongScope = await resolve(state.wrongScope!, { objectType: "person", objectId: state.personId! });
    assert.equal(wrongScope.status, 403, `缺 scope 应 403: ${JSON.stringify(wrongScope.data)}`);
    assert.equal(asError(wrongScope.data).code, "API_KEY_SCOPE_DENIED");

    // 调用方是谁由凭据决定：body 里再填 system 属于越权寻址，契约层直接拒。
    const withSystem = await resolve(state.fs!, { system: state.fs!.clientKey, objectType: "person", objectId: state.personId! });
    assert.equal(withSystem.status, 400, `携带 system 应 400: ${JSON.stringify(withSystem.data)}`);
    assert.equal(asError(withSystem.data).code, "INVALID_REQUEST");

    const badType = await resolve(state.fs!, { objectType: "inquiry", objectId: "x" });
    assert.equal(badType.status, 400, `未知 objectType 应 400: ${JSON.stringify(badType.data)}`);
    assert.equal(asError(badType.data).code, "INVALID_REQUEST");

    const missing = await resolve(state.fs!, { objectType: "person", objectId: "00000000-0000-0000-0000-000000000000" });
    assert.equal(missing.status, 404);
    assert.equal(asError(missing.data).code, "SOURCE_REF_NOT_FOUND");

    const client = await db();
    const fsRow = await client.channelClient.findUniqueOrThrow({ where: { key: state.fs!.clientKey } });
    await client.channelClient.update({ where: { id: fsRow.id }, data: { isActive: false } });
    const deactivated = await resolve(state.fs!, { objectType: "person", objectId: state.personId! });
    assert.equal(deactivated.status, 401, "停用客户端的 API Key 即刻失效（认证层失败关闭）");
    assert.equal(asError(deactivated.data).code, "API_KEY_INVALID");
    await client.channelClient.update({ where: { id: fsRow.id }, data: { isActive: true } });
  });
});
