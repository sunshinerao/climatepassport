/**
 * API 集成测试：V2.1 多 Programme scope 越权矩阵（CP-TODO-241 / CP-FR-050/051，CP-AUD-003）
 *
 * 覆盖（真实数据库 + 真实会话，三个虚构 Programme、两个 Edition）：
 * - 同 Programme 同 Edition 授权读写通过（membership 正路径 + ObjectAuthorization 正路径）
 * - 跨 Programme 拒绝、跨 Edition 拒绝、未知/停用 scope 拒绝、匿名默认拒绝
 * - 全局角色（含 ADMIN）不自动跨 Programme；撤权后旧访问立即失效
 * - scope 角色层级：VIEWER 成员写拒绝；scope 写入断言在 canManageActivity 之后仍生效
 * - 无映射的遗留 Activity 行为不变（夏校冻结兼容控制）
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

function skipUnlessReady(t: { skip: (reason: string) => void }) {
  if (!serverReady) t.skip("目标服务器未就绪，跳过 API 测试");
}

async function db() {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

const emails = {
  p1Admin: `scope_p1admin_${suffix}@example.com`,
  p2Admin: `scope_p2admin_${suffix}@example.com`,
  p1Viewer: `scope_p1viewer_${suffix}@example.com`,
  p1EdB: `scope_p1edb_${suffix}@example.com`,
  p3Admin: `scope_p3admin_${suffix}@example.com`,
  globalAdmin: `scope_gadmin_${suffix}@example.com`,
  plain: `scope_plain_${suffix}@example.com`,
};

const clients = Object.fromEntries(
  Object.keys(emails).map((key) => [key, new ApiClient(baseURL)]),
) as Record<keyof typeof emails, ApiClient>;
const anonymousClient = new ApiClient(baseURL);

const state: {
  institutionId?: string;
  activityP1E1a?: string;
  activityP1E1aViewerOwned?: string;
  activityP1WideOwnedByP2?: string;
  activityP2?: string;
  activityP3?: string;
  activityLegacy?: string;
  membershipP1AdminId?: string;
} = {};

async function createUser(email: string, name: string, role: "ATTENDEE" | "EVENT_MANAGER" | "ADMIN", passwordHash: string) {
  const client = await db();
  return client.user.create({
    data: { email, name, role, password: passwordHash, emailVerified: new Date() },
    select: { id: true },
  });
}

async function login(key: keyof typeof emails, t: { skip: (reason: string) => void }) {
  const response = await clients[key].login(buildLoginPayload(locale, emails[key], "ScopePassword123!"));
  if (response.status === 403 && (response.data as { requiresVerification?: boolean }).requiresVerification) {
    t.skip("测试账号未验证邮箱，跳过 scope 越权矩阵");
    return false;
  }
  assert.equal(response.status, 200, `登录失败 (${emails[key]}): ${JSON.stringify(response.data)}`);
  return true;
}

async function createActivity(title: string, organizerUserId: string) {
  const client = await db();
  const activity = await client.activity.create({
    data: {
      type: "EVENT",
      title,
      slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${suffix}`,
      status: "PUBLISHED",
      language: "en",
      createdByUserId: organizerUserId,
      organizerUserId,
    },
    select: { id: true },
  });
  return activity.id;
}

async function bindScope(activityId: string, programmeId: string, editionId: string | null, sourceObjectId: string) {
  const client = await db();
  await client.sourceObjectMapping.create({
    data: {
      programmeId,
      editionId,
      sourceSystem: `scope-test-${suffix}`,
      sourceObjectId,
      activityId,
      sourceVersion: "v1",
      authoritativeFieldsJson: ["title", "startTime"],
    },
  });
}

before(async () => {
  serverReady = await waitForServer(baseURL, 30000);
});

describe("V2.1 多 Programme scope 越权矩阵（CP-TODO-241）", () => {
  test("准备：三 Programme / 两 Edition、七账号、scope 绑定与遗留控制活动", async (t) => {
    skipUnlessReady(t);
    const client = await db();
    const passwordHash = await hash("ScopePassword123!", 10);

    const tenant = await client.tenant.create({
      data: { key: `scope-tenant-${suffix}`, name: `Scope Tenant ${suffix}` },
      select: { id: true },
    });
    const [p1, p2, p3] = await Promise.all(
      [
        { key: `aurora-${suffix}`, name: "Aurora (scope test)" },
        { key: `boreal-${suffix}`, name: "Boreal (scope test)" },
        { key: `cinder-${suffix}`, name: "Cinder (scope test)" },
      ].map((programme) => client.programme.create({ data: { ...programme, tenantId: tenant.id }, select: { id: true } })),
    );
    const e1a = await client.edition.create({ data: { programmeId: p1.id, key: "2026", name: "Aurora 2026" }, select: { id: true } });
    const e1b = await client.edition.create({ data: { programmeId: p1.id, key: "2027", name: "Aurora 2027" }, select: { id: true } });
    const e2a = await client.edition.create({ data: { programmeId: p2.id, key: "2026", name: "Boreal 2026" }, select: { id: true } });
    const e3a = await client.edition.create({ data: { programmeId: p3.id, key: "2026", name: "Cinder 2026" }, select: { id: true } });

    const users = {
      p1Admin: await createUser(emails.p1Admin, "P1 Admin (scope)", "EVENT_MANAGER", passwordHash),
      p2Admin: await createUser(emails.p2Admin, "P2 Admin (scope)", "EVENT_MANAGER", passwordHash),
      p1Viewer: await createUser(emails.p1Viewer, "P1 Viewer (scope)", "EVENT_MANAGER", passwordHash),
      p1EdB: await createUser(emails.p1EdB, "P1 EditionB Admin (scope)", "EVENT_MANAGER", passwordHash),
      p3Admin: await createUser(emails.p3Admin, "P3 Admin (scope)", "EVENT_MANAGER", passwordHash),
      globalAdmin: await createUser(emails.globalAdmin, "Global Admin (scope)", "ADMIN", passwordHash),
      plain: await createUser(emails.plain, "Plain User (scope)", "ATTENDEE", passwordHash),
    };

    const grantMembership = async (
      userId: string,
      programmeId: string,
      editionId: string | null,
      role: "PROGRAMME_ADMIN" | "PROGRAMME_OPERATOR" | "PROGRAMME_VIEWER",
      grantorUserId: string,
    ) =>
      client.accessMembership.create({
        data: { userId, programmeId, editionId, role, grantorUserId },
        select: { id: true },
      });

    const m1 = await grantMembership(users.p1Admin.id, p1.id, e1a.id, "PROGRAMME_ADMIN", users.globalAdmin.id);
    state.membershipP1AdminId = m1.id;
    await grantMembership(users.p2Admin.id, p2.id, e2a.id, "PROGRAMME_ADMIN", users.globalAdmin.id);
    await grantMembership(users.p1Viewer.id, p1.id, e1a.id, "PROGRAMME_VIEWER", users.globalAdmin.id);
    await grantMembership(users.p1EdB.id, p1.id, e1b.id, "PROGRAMME_ADMIN", users.globalAdmin.id);
    await grantMembership(users.p3Admin.id, p3.id, e3a.id, "PROGRAMME_ADMIN", users.globalAdmin.id);

    const institution = await client.institution.create({
      data: { slug: `scope-inst-${suffix}`, name: `Scope Institution ${suffix}` },
      select: { id: true },
    });
    state.institutionId = institution.id;

    state.activityP1E1a = await createActivity(`Scope P1E1a ${suffix}`, users.p1Admin.id);
    await bindScope(state.activityP1E1a, p1.id, e1a.id, `src-p1-${suffix}`);

    state.activityP1E1aViewerOwned = await createActivity(`Scope P1E1a ViewerOwned ${suffix}`, users.p1Viewer.id);
    await bindScope(state.activityP1E1aViewerOwned, p1.id, e1a.id, `src-p1v-${suffix}`);

    state.activityP1WideOwnedByP2 = await createActivity(`Scope P1 OwnedByP2 ${suffix}`, users.p2Admin.id);
    await bindScope(state.activityP1WideOwnedByP2, p1.id, e1a.id, `src-p1x-${suffix}`);

    state.activityP2 = await createActivity(`Scope P2 ${suffix}`, users.p2Admin.id);
    await bindScope(state.activityP2, p2.id, e2a.id, `src-p2-${suffix}`);

    state.activityP3 = await createActivity(`Scope P3 ${suffix}`, users.p3Admin.id);
    await bindScope(state.activityP3, p3.id, e3a.id, `src-p3-${suffix}`);
    await client.programme.update({ where: { id: p3.id }, data: { isActive: false } });

    state.activityLegacy = await createActivity(`Scope Legacy ${suffix}`, users.p1Admin.id);

    await client.objectAuthorization.create({
      data: {
        subjectUserId: users.plain.id,
        objectType: "activity",
        objectId: state.activityP1E1a,
        programmeId: p1.id,
        editionId: e1a.id,
        action: "READ",
        purpose: "scope matrix object grant",
        grantorUserId: users.p1Admin.id,
      },
    });

    for (const key of Object.keys(emails) as Array<keyof typeof emails>) {
      assert.ok(await login(key, t), `登录失败: ${key}`);
    }
  });

  test("同 Programme 同 Edition：PROGRAMME_ADMIN 读取通过", async (t) => {
    skipUnlessReady(t);
    const response = await clients.p1Admin.get(`/api/activities/${state.activityP1E1a}/institutions`);
    assert.equal(response.status, 200, `同范围管理员读取被拒: ${JSON.stringify(response.data)}`);
  });

  test("同 Programme 同 Edition：PROGRAMME_VIEWER 读取通过", async (t) => {
    skipUnlessReady(t);
    const response = await clients.p1Viewer.get(`/api/activities/${state.activityP1E1a}/institutions`);
    assert.equal(response.status, 200, `只读成员读取被拒: ${JSON.stringify(response.data)}`);
  });

  test("对象级授权：非成员凭 ObjectAuthorization 读取通过", async (t) => {
    skipUnlessReady(t);
    const response = await clients.plain.get(`/api/activities/${state.activityP1E1a}/institutions`);
    assert.equal(response.status, 200, `对象级授权读取被拒: ${JSON.stringify(response.data)}`);
  });

  test("跨 Programme：P2 管理员读 P1 对象拒绝", async (t) => {
    skipUnlessReady(t);
    const response = await clients.p2Admin.get(`/api/activities/${state.activityP1E1a}/institutions`);
    assert.equal(response.status, 403, `跨 Programme 读取应 403，实际 ${response.status}: ${JSON.stringify(response.data)}`);
  });

  test("跨 Edition：仅 E1B 授权的成员读 E1A 对象拒绝", async (t) => {
    skipUnlessReady(t);
    const response = await clients.p1EdB.get(`/api/activities/${state.activityP1E1a}/institutions`);
    assert.equal(response.status, 403, `跨 Edition 读取应 403，实际 ${response.status}: ${JSON.stringify(response.data)}`);
  });

  test("全局 ADMIN 不自动跨 Programme：无 membership 读取拒绝", async (t) => {
    skipUnlessReady(t);
    const response = await clients.globalAdmin.get(`/api/activities/${state.activityP1E1a}/institutions`);
    assert.equal(response.status, 403, "全局角色（含 ADMIN）不得自动获得 Programme 范围访问");
  });

  test("无任何授权的普通用户与匿名访问均默认拒绝", async (t) => {
    skipUnlessReady(t);
    const plain = await clients.plain.get(`/api/activities/${state.activityP1WideOwnedByP2}/institutions`);
    assert.equal(plain.status, 403, `无授权用户读取应 403，实际 ${plain.status}`);
    const anonymous = await anonymousClient.get(`/api/activities/${state.activityP1E1a}/institutions`);
    assert.equal(anonymous.status, 403, "匿名访问 scope 对象应默认拒绝");
  });

  test("未知/停用 scope：Programme 停用后其成员访问拒绝", async (t) => {
    skipUnlessReady(t);
    const response = await clients.p3Admin.get(`/api/activities/${state.activityP3}/institutions`);
    assert.equal(response.status, 403, `停用 Programme 的 scope 应按未知 scope 拒绝，实际 ${response.status}`);
  });

  test("遗留无映射 Activity 行为不变（含匿名访问）", async (t) => {
    skipUnlessReady(t);
    const response = await clients.p1Admin.get(`/api/activities/${state.activityLegacy}/institutions`);
    assert.equal(response.status, 200, `遗留对象读取应不受影响: ${JSON.stringify(response.data)}`);
    const anonymous = await anonymousClient.get(`/api/activities/${state.activityLegacy}/institutions`);
    assert.equal(anonymous.status, 200, "遗留对象匿名访问应保持原行为");
  });

  test("写路径：同 Programme 同 Edition 的 PROGRAMME_ADMIN 写入通过", async (t) => {
    skipUnlessReady(t);
    const response = await clients.p1Admin.post(`/api/activities/${state.activityP1E1a}/institutions`, {
      institutionId: state.institutionId,
    });
    assert.ok([200, 201].includes(response.status), `同范围管理员写入被拒: ${JSON.stringify(response.data)}`);
  });

  test("写路径：scope 断言在 canManageActivity 之后仍生效（全局 ADMIN 被自己组织的 scoped 活动拒绝）", async (t) => {
    skipUnlessReady(t);
    const response = await clients.globalAdmin.post(`/api/activities/${state.activityP1WideOwnedByP2}/institutions`, {
      institutionId: state.institutionId,
    });
    assert.equal(response.status, 403, `scope 写拒绝应 403，实际 ${response.status}: ${JSON.stringify(response.data)}`);
  });

  test("写路径：跨 Programme 组织者写入拒绝", async (t) => {
    skipUnlessReady(t);
    const response = await clients.p2Admin.post(`/api/activities/${state.activityP1WideOwnedByP2}/institutions`, {
      institutionId: state.institutionId,
    });
    assert.equal(response.status, 403, `跨 Programme 写入应 403，实际 ${response.status}`);
  });

  test("写路径：PROGRAMME_VIEWER 成员写入拒绝（scope 角色层级）", async (t) => {
    skipUnlessReady(t);
    const response = await clients.p1Viewer.post(`/api/activities/${state.activityP1E1aViewerOwned}/institutions`, {
      institutionId: state.institutionId,
    });
    assert.equal(response.status, 403, `VIEWER 成员写入应 403，实际 ${response.status}: ${JSON.stringify(response.data)}`);
  });

  test("撤权后旧访问立即失效", async (t) => {
    skipUnlessReady(t);
    const client = await db();
    await client.accessMembership.update({
      where: { id: state.membershipP1AdminId },
      data: { revokedAt: new Date() },
    });
    const response = await clients.p1Admin.get(`/api/activities/${state.activityP1E1a}/institutions`);
    assert.equal(response.status, 403, `撤权后读取应失效为 403，实际 ${response.status}: ${JSON.stringify(response.data)}`);
  });
});
