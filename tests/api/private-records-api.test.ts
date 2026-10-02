/**
 * API 集成测试：私密记录 + 不可变修订 + 对象级协作授权（CP-TODO-247 / CP-FR-057/071）
 *
 * 覆盖（真实数据库 + 真实会话）：
 * - 匿名 POST /api/records 401；匿名 GET /api/records 401
 * - owner 创建记录 201（首条不可变修订，revision=1）；body 校验失败 400
 * - 越权矩阵：outsider GET/PATCH/DELETE /api/records/[id] 403（RECORD_ACCESS_DENIED）
 * - 乐观并发：expectedRevision=1 命中 200 revision=2；再以旧 revision PATCH 409
 *   （RECORD_REVISION_CONFLICT），payload 未被覆盖（GET 验证 currentRevision=2）
 * - 修订历史：GET /api/records/[id]/revisions 200 且 2 条升序；匿名 401；outsider 403
 * - 对象授权：owner 授 READ（purpose=peer_review）201；grantee GET 200 / PATCH 403；
 *   owner 撤权 200 即时生效（grantee 再读 403）；二次撤销 409
 * - Programme 成员：PROGRAMME_VIEWER 成员读 200；outsider 读 403；viewer 写 403
 * - 撤回：owner DELETE 200；outsider GET 404（不泄漏存在性）；owner PATCH 409
 *   （RECORD_WITHDRAWN）；owner GET 仍 200（可见 WITHDRAWN 状态）
 * - 审计断言：record.create/update/grant/revoke/withdraw 各至少一条落 core_audit_logs
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

let serverReady = false;
let prisma: PrismaClient | null = null;

const adminClient = new ApiClient(baseURL);
const ownerClient = new ApiClient(baseURL);
const granteeClient = new ApiClient(baseURL);
const outsiderClient = new ApiClient(baseURL);
const viewerClient = new ApiClient(baseURL);
const anonymousClient = new ApiClient(baseURL);

const state: {
  ownerId?: string;
  granteeId?: string;
  programmeId?: string;
  recordId?: string;
  grantId?: string;
  programmeRecordId?: string;
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

async function createUser(client: PrismaClient, email: string, name: string, passwordHash: string) {
  return client.user.create({
    data: { email, password: passwordHash, name, role: "ATTENDEE", emailVerified: new Date() },
    select: { id: true },
  });
}

async function login(client: ApiClient, email: string, t: { skip: (reason: string) => void }) {
  const response = await client.login(buildLoginPayload(locale, email, "seeded-password"));
  if (response.status === 403 && (response.data as { requiresVerification?: boolean }).requiresVerification) {
    t.skip("账号未验证邮箱，跳过私密记录测试");
    return false;
  }
  assert.equal(response.status, 200, `登录失败 (${email}): ${JSON.stringify(response.data)}`);
  return true;
}

before(async () => {
  serverReady = await waitForServer(baseURL, 30000);
});

describe("私密记录与对象级授权（CP-TODO-247）", () => {
  test("准备：账号 / tenant+programme+edition / viewer 成员关系", async (t) => {
    skipUnlessReady(t);
    const seeded = testData.seededUsers;
    assert.ok(await login(adminClient, seeded.admin.email, t));

    const client = await db();
    const passwordHash = await hash("seeded-password", 10);
    const emails = {
      owner: `rec_owner_${suffix}@example.com`,
      grantee: `rec_grantee_${suffix}@example.com`,
      outsider: `rec_outsider_${suffix}@example.com`,
      viewer: `rec_viewer_${suffix}@example.com`,
    };
    const [owner, grantee, outsider, viewer] = await Promise.all([
      createUser(client, emails.owner, "Record Owner", passwordHash),
      createUser(client, emails.grantee, "Record Grantee", passwordHash),
      createUser(client, emails.outsider, "Record Outsider", passwordHash),
      createUser(client, emails.viewer, "Record Viewer", passwordHash),
    ]);
    state.ownerId = owner.id;
    state.granteeId = grantee.id;
    assert.ok(await login(ownerClient, emails.owner, t));
    assert.ok(await login(granteeClient, emails.grantee, t));
    assert.ok(await login(outsiderClient, emails.outsider, t));
    assert.ok(await login(viewerClient, emails.viewer, t));

    const tenant = await client.tenant.create({
      data: { key: `rec-tenant-${suffix}`, name: `Record Tenant ${suffix}` },
      select: { id: true },
    });
    const programme = await client.programme.create({
      data: { key: `rec-prog-${suffix}`, name: `Record Programme ${suffix}`, tenantId: tenant.id },
      select: { id: true },
    });
    state.programmeId = programme.id;
    await client.edition.create({
      data: { programmeId: programme.id, key: "2026", name: `Record Edition ${suffix}` },
    });

    // viewer 为 Programme 级只读成员（editionId=null 覆盖全 Programme）
    await client.accessMembership.create({
      data: { userId: viewer.id, programmeId: programme.id, editionId: null, role: "PROGRAMME_VIEWER" },
    });
  });

  test("创建记录：匿名 401，owner 201 revision=1，body 校验失败 400", async (t) => {
    skipUnlessReady(t);

    const anonymousPost = await anonymousClient.post("/api/records", {
      recordType: "project_journal",
      title: `Anonymous Journal ${suffix}`,
      payloadJson: { entry: "should not exist" },
    });
    assert.equal(anonymousPost.status, 401, "匿名创建必须 401");

    const anonymousList = await anonymousClient.get("/api/records");
    assert.equal(anonymousList.status, 401, "匿名列表必须 401");

    const create = await ownerClient.post("/api/records", {
      recordType: "project_journal",
      title: `Journal ${suffix}`,
      payloadJson: { entry: "first", mood: "hopeful" },
    });
    assert.equal(create.status, 201, `创建记录失败: ${JSON.stringify(create.data)}`);
    state.recordId = (create.data as { recordId: string }).recordId;
    assert.ok(state.recordId, "应返回 recordId");
    assert.equal((create.data as { revision: number }).revision, 1, "首条修订应为 revision=1");

    const invalid = await ownerClient.post("/api/records", {
      recordType: "Project Journal",
      title: `Bad Journal ${suffix}`,
      payloadJson: {},
    });
    assert.equal(invalid.status, 400, "recordType 不合规的 body 必须 400");
  });

  test("越权矩阵：outsider GET/PATCH/DELETE 403 RECORD_ACCESS_DENIED", async (t) => {
    skipUnlessReady(t);

    const read = await outsiderClient.get(`/api/records/${state.recordId}`);
    assert.equal(read.status, 403, "outsider 读取必须 403");
    assert.equal((read.data as { code: string }).code, "RECORD_ACCESS_DENIED");

    const update = await outsiderClient.patch(`/api/records/${state.recordId}`, {
      expectedRevision: 1,
      payloadJson: { entry: "hijacked" },
    });
    assert.equal(update.status, 403, "outsider 更新必须 403");
    assert.equal((update.data as { code: string }).code, "RECORD_ACCESS_DENIED");

    const withdraw = await outsiderClient.delete(`/api/records/${state.recordId}`);
    assert.equal(withdraw.status, 403, "outsider 撤回必须 403");
    assert.equal((withdraw.data as { code: string }).code, "RECORD_ACCESS_DENIED");
  });

  test("乐观并发：CAS 命中 200 revision=2，旧 revision 409 且不覆盖 payload", async (t) => {
    skipUnlessReady(t);

    const update = await ownerClient.patch(`/api/records/${state.recordId}`, {
      expectedRevision: 1,
      payloadJson: { entry: "second", mood: "determined" },
    });
    assert.equal(update.status, 200, `CAS 更新失败: ${JSON.stringify(update.data)}`);
    assert.equal((update.data as { revision: number }).revision, 2);

    const conflict = await ownerClient.patch(`/api/records/${state.recordId}`, {
      expectedRevision: 1,
      payloadJson: { entry: "conflicting overwrite attempt" },
    });
    assert.equal(conflict.status, 409, "旧 expectedRevision 必须 409");
    assert.equal((conflict.data as { code: string }).code, "RECORD_REVISION_CONFLICT");

    const read = await ownerClient.get(`/api/records/${state.recordId}`);
    assert.equal(read.status, 200);
    const record = (read.data as { record: { currentRevision: number; payloadJson: { entry?: string } } }).record;
    assert.equal(record.currentRevision, 2, "currentRevision 应为 2");
    assert.equal(record.payloadJson.entry, "second", "冲突请求不得覆盖 payload");
  });

  test("修订历史：2 条升序，匿名 401，outsider 403", async (t) => {
    skipUnlessReady(t);

    const anonymous = await anonymousClient.get(`/api/records/${state.recordId}/revisions`);
    assert.equal(anonymous.status, 401, "匿名读取修订历史必须 401");

    const outsider = await outsiderClient.get(`/api/records/${state.recordId}/revisions`);
    assert.equal(outsider.status, 403, "outsider 读取修订历史必须 403");

    const owner = await ownerClient.get(`/api/records/${state.recordId}/revisions`);
    assert.equal(owner.status, 200, `读取修订历史失败: ${JSON.stringify(owner.data)}`);
    const revisions = (owner.data as { revisions: Array<{ revision: number }> }).revisions;
    assert.equal(revisions.length, 2, "应有 2 条不可变修订");
    assert.deepEqual(revisions.map((revision) => revision.revision), [1, 2], "修订必须按升序返回");
  });

  test("对象授权：授予 READ，撤权即时生效，二次撤销 409", async (t) => {
    skipUnlessReady(t);

    const grant = await ownerClient.post(`/api/records/${state.recordId}/grants`, {
      subjectUserId: state.granteeId,
      action: "READ",
      purpose: "peer_review",
    });
    assert.equal(grant.status, 201, `授予失败: ${JSON.stringify(grant.data)}`);
    state.grantId = (grant.data as { grantId: string }).grantId;
    assert.ok(state.grantId, "应返回 grantId");

    const granteeRead = await granteeClient.get(`/api/records/${state.recordId}`);
    assert.equal(granteeRead.status, 200, "被授权人应可读取记录");

    const granteeWrite = await granteeClient.patch(`/api/records/${state.recordId}`, {
      expectedRevision: 2,
      payloadJson: { entry: "grantee write attempt" },
    });
    assert.equal(granteeWrite.status, 403, "READ 授权不得包含写权限");

    const revoke = await ownerClient.delete(`/api/records/${state.recordId}/grants/${state.grantId}`);
    assert.equal(revoke.status, 200, `撤权失败: ${JSON.stringify(revoke.data)}`);

    const afterRevoke = await granteeClient.get(`/api/records/${state.recordId}`);
    assert.equal(afterRevoke.status, 403, "撤权必须即时生效");

    const secondRevoke = await ownerClient.delete(`/api/records/${state.recordId}/grants/${state.grantId}`);
    assert.equal(secondRevoke.status, 409, "重复撤销必须 409");
  });

  test("Programme 成员：viewer 读 200，outsider 读 403，viewer 写 403", async (t) => {
    skipUnlessReady(t);

    const create = await ownerClient.post("/api/records", {
      recordType: "project_journal",
      title: `Programme Journal ${suffix}`,
      payloadJson: { entry: "programme scoped" },
      programmeId: state.programmeId,
    });
    assert.equal(create.status, 201, `创建 Programme 记录失败: ${JSON.stringify(create.data)}`);
    state.programmeRecordId = (create.data as { recordId: string }).recordId;

    const viewerRead = await viewerClient.get(`/api/records/${state.programmeRecordId}`);
    assert.equal(viewerRead.status, 200, `viewer 成员读失败: ${JSON.stringify(viewerRead.data)}`);

    const outsiderRead = await outsiderClient.get(`/api/records/${state.programmeRecordId}`);
    assert.equal(outsiderRead.status, 403, "非成员读取 Programme 记录必须 403");

    const viewerWrite = await viewerClient.patch(`/api/records/${state.programmeRecordId}`, {
      expectedRevision: 1,
      payloadJson: { entry: "viewer write attempt" },
    });
    assert.equal(viewerWrite.status, 403, "PROGRAMME_VIEWER 不得写 Programme 记录");
  });

  test("撤回：outsider 404，owner PATCH 409 RECORD_WITHDRAWN，owner 可见 WITHDRAWN", async (t) => {
    skipUnlessReady(t);

    const withdraw = await ownerClient.delete(`/api/records/${state.recordId}`);
    assert.equal(withdraw.status, 200, `撤回失败: ${JSON.stringify(withdraw.data)}`);

    const outsiderAfter = await outsiderClient.get(`/api/records/${state.recordId}`);
    assert.equal(outsiderAfter.status, 404, "撤回后非所有者不得感知记录存在");
    assert.equal((outsiderAfter.data as { code: string }).code, "RECORD_NOT_FOUND");

    const ownerPatch = await ownerClient.patch(`/api/records/${state.recordId}`, {
      expectedRevision: 2,
      payloadJson: { entry: "late update after withdraw" },
    });
    assert.equal(ownerPatch.status, 409, "撤回后更新必须 409");
    assert.equal((ownerPatch.data as { code: string }).code, "RECORD_WITHDRAWN");

    const ownerRead = await ownerClient.get(`/api/records/${state.recordId}`);
    assert.equal(ownerRead.status, 200, "所有者应仍可读取已撤回记录");
    assert.equal(
      (ownerRead.data as { record: { status: string } }).record.status,
      "WITHDRAWN",
      "所有者应看到 WITHDRAWN 状态",
    );
  });

  test("记录审计：create/update/grant/revoke/withdraw 均落库", async (t) => {
    skipUnlessReady(t);
    const client = await db();
    const audits = await client.coreAuditLog.findMany({
      where: {
        createdAt: { gte: runStartedAt },
        action: { in: ["record.create", "record.update", "record.grant", "record.revoke", "record.withdraw"] },
      },
    });
    const actions = new Set(audits.map((audit) => audit.action));
    for (const action of ["record.create", "record.update", "record.grant", "record.revoke", "record.withdraw"]) {
      assert.equal(actions.has(action), true, `缺少审计动作 ${action}`);
    }
  });
});
