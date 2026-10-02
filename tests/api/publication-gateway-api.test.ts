/**
 * API 集成测试：发布网关（CP-TODO-251 / CP-FR-061/068）
 *
 * 覆盖矩阵（真实数据库 + 真实会话/API Key 鉴权）：
 * - 准备：owner/outsider/consenting 三个账号（bcrypt 建号 + 登录）；owner 经
 *   POST /api/records 建 scoped_record；登记 MACHINE 客户端（scope 含
 *   channel:decisions:submit + dispatch:publications，callbackUrl 指向本地
 *   不可用地址 http://127.0.0.1:9/hook）
 * - 发布权限：outsider POST /api/publications → 403 RECORD_ACCESS_DENIED；
 *   匿名 POST → 401
 * - 发布：owner POST v1 → 201 {publicationId, deduplicated:false}；公开 GET
 *   ?objectType=scoped_record&objectId=... → 200 {publication:{version:1,...}}，
 *   响应头 cache-control 含 no-store；带 &version=1 也 200
 * - 幂等与冲突：owner 重复发同内容 → 201 deduplicated=true（同 publicationId）；
 *   同 version 异 projectionJson → 409 PUBLICATION_CONFLICT
 * - 新版：owner 发 version=2 → 201；默认 GET 返回 v2；?version=1 仍返回 v1
 * - 撤回：owner POST /api/publications/withdraw v2 → 200；随后 GET ?version=2 →
 *   404 PUBLICATION_NOT_FOUND 且 no-store；?version=1 仍 200；重复撤回 200（幂等）；
 *   outsider 撤回 v1 → 403
 *   注：默认 GET 语义为"最新 PUBLISHED 版本"（readPublishedProjection），
 *   v1 仍发布时默认读返回 v1（200）而非 404；"撤回后默认读 404"由下一用例的
 *   唯一版本对象覆盖。
 * - 恢复保护：对已撤回的 v2 再发布 → 409 PUBLICATION_RESTORE_FORBIDDEN；
 *   发 version=3 → 201；默认 GET 返回 v3；?version=2 仍 404
 * - 唯一版本撤回：对象 D 发 v1 → 撤回 v1 → 默认 GET → 404 no-store
 * - 同意门：owner 发新记录 B 并带 consentRequirements（consenting/image_use）
 *   无同意 → 403 CONSENT_REQUIRED；consenting 登录 POST /api/consents 自授后
 *   owner 再发 → 201；consenting 撤回同意后 owner 发新版本 → 403 CONSENT_WITHDRAWN
 * - 批准回执门：approvalReceipt:true 时无 APPROVED 回执 → 403 RECEIPT_ISSUER_UNVERIFIED；
 *   机器 key 经 Open API 提交 APPROVED publication_approval（objectRevision 达标）后 → 201；
 *   提交 REVOKED（objectRevision 更高）后同版本门再发布 → 403；无门路径（默认）不受回执影响。
 * - dispatch 扇出：发布后 prisma 直查 outbound_dispatch 存在
 *   eventType=publication.published、payload.objectId 匹配的行，payload 不含
 *   projectionJson 正文（无 marker 串）；撤回后存在 publication.withdrawn 行
 * - 审计：publication.publish / publication.withdraw 落库 core_audit_logs
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

const markerV1 = `PUB_MARKER_V1_${suffix}`;
const markerV2 = `PUB_MARKER_V2_${suffix}`;
const markerV3 = `PUB_MARKER_V3_${suffix}`;

let serverReady = false;
let prisma: PrismaClient | null = null;

const adminClient = new ApiClient(baseURL);
const ownerClient = new ApiClient(baseURL);
const outsiderClient = new ApiClient(baseURL);
const consentingClient = new ApiClient(baseURL);
const anonymousClient = new ApiClient(baseURL);
const machineClient = new ApiClient(baseURL);

const state: {
  consentingUserId?: string;
  machineClientDbId?: string;
  machineClientKey?: string;
  machineKey?: string;
  recordAId?: string;
  recordBId?: string;
  recordCId?: string;
  recordDId?: string;
  publicationA1Id?: string;
  consentId?: string;
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

async function login(client: ApiClient, email: string, t: { skip: (reason: string) => void }) {
  const response = await client.login(buildLoginPayload(locale, email, "seeded-password"));
  if (response.status === 403 && (response.data as { requiresVerification?: boolean }).requiresVerification) {
    t.skip("账号未验证邮箱，跳过发布网关测试");
    return false;
  }
  assert.equal(response.status, 200, `登录失败 (${email}): ${JSON.stringify(response.data)}`);
  return true;
}

/** Open API：登记密钥的对外形态是 bearer `<clientKey>.<machineKey>`。 */
function openBearer() {
  return { Authorization: `Bearer ${state.machineClientKey}.${state.machineKey}` };
}

function publishBody(objectId: string, version: number, projectionJson: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return {
    objectType: "scoped_record",
    objectId,
    version,
    projectionJson,
    ...extra,
  };
}

function projectionV1() {
  return { title: `Public A v1 ${suffix}`, body: "public projection v1", marker: markerV1 };
}

async function createRecord(recordType: string, title: string, secret: string) {
  const response = await ownerClient.post("/api/records", {
    recordType,
    title,
    payloadJson: { privateNote: secret },
  });
  assert.equal(response.status, 201, `创建记录失败 (${recordType}): ${JSON.stringify(response.data)}`);
  return (response.data as { recordId: string; revision: number }).recordId;
}

function assertNoStore(headers: Headers, context: string) {
  const cacheControl = headers.get("cache-control") ?? "";
  assert.equal(cacheControl.includes("no-store"), true, `${context} 响应必须 no-store`);
}

before(async () => {
  serverReady = await waitForServer(baseURL, 30000);
});

describe("发布网关（CP-TODO-251）", () => {
  test("准备：账号/记录/MACHINE 客户端（dispatch 订阅 + 回执提交）", async (t) => {
    skipUnlessReady(t);
    const seeded = testData.seededUsers;
    assert.ok(await login(adminClient, seeded.admin.email, t));

    const client = await db();
    const passwordHash = await hash("seeded-password", 10);
    const emails = {
      owner: `pub_owner_${suffix}@example.com`,
      outsider: `pub_outsider_${suffix}@example.com`,
      consenting: `pub_consenting_${suffix}@example.com`,
    };
    const [owner, , consenting] = await Promise.all([
      client.user.create({
        data: { email: emails.owner, name: "Publication Owner", password: passwordHash, role: "ATTENDEE", emailVerified: new Date() },
        select: { id: true },
      }),
      client.user.create({
        data: { email: emails.outsider, name: "Publication Outsider", password: passwordHash, role: "ATTENDEE", emailVerified: new Date() },
        select: { id: true },
      }),
      client.user.create({
        data: { email: emails.consenting, name: "Publication Consenting", password: passwordHash, role: "ATTENDEE", emailVerified: new Date() },
        select: { id: true },
      }),
    ]);
    state.consentingUserId = consenting.id;
    assert.ok(await login(ownerClient, emails.owner, t));
    assert.ok(await login(outsiderClient, emails.outsider, t));
    assert.ok(await login(consentingClient, emails.consenting, t));

    const tenant = await client.tenant.create({
      data: { key: `pub-tenant-${suffix}`, name: `Publication Tenant ${suffix}` },
      select: { id: true },
    });
    const programme = await client.programme.create({
      data: { key: `pub-prog-${suffix}`, name: `Publication Programme ${suffix}`, tenantId: tenant.id },
      select: { id: true },
    });

    const register = await adminClient.post("/api/admin/channel-clients", {
      displayName: `Publication Hook ${suffix}`,
      type: "MACHINE",
      programmeId: programme.id,
      allowedOrigins: [],
      allowedScopes: ["channel:decisions:submit", "dispatch:publications"],
      machineKey: `cpmk_pub_${suffix}`,
      callbackUrl: "http://127.0.0.1:9/hook",
    });
    assert.equal(register.status, 201, `登记机器客户端失败: ${JSON.stringify(register.data)}`);
    const body = register.data as { client: { id: string; key: string }; machineKey?: string };
    state.machineClientDbId = body.client.id;
    state.machineClientKey = body.client.key;
    state.machineKey = body.machineKey;

    state.recordAId = await createRecord(`pub_a_${suffix}`, `Publication Record A ${suffix}`, `SECRET_A_${suffix}`);
    state.recordDId = await createRecord(`pub_d_${suffix}`, `Publication Record D ${suffix}`, `SECRET_D_${suffix}`);
  });

  test("发布权限：outsider 403，匿名 401", async (t) => {
    skipUnlessReady(t);

    const outsider = await outsiderClient.post("/api/publications", publishBody(state.recordAId!, 1, projectionV1()));
    assert.equal(outsider.status, 403, "outsider 发布必须 403");
    assert.equal((outsider.data as { code?: string }).code, "RECORD_ACCESS_DENIED");

    const anonymous = await anonymousClient.post("/api/publications", publishBody(state.recordAId!, 1, projectionV1()));
    assert.equal(anonymous.status, 401, "匿名发布必须 401");
  });

  test("发布 v1：owner 201；公开读 200 且 no-store；version=1 读 200", async (t) => {
    skipUnlessReady(t);

    const publish = await ownerClient.post("/api/publications", publishBody(state.recordAId!, 1, projectionV1()));
    assert.equal(publish.status, 201, `发布 v1 失败: ${JSON.stringify(publish.data)}`);
    const publishBody1 = publish.data as { publicationId: string; deduplicated: boolean };
    assert.equal(publishBody1.deduplicated, false);
    assert.ok(publishBody1.publicationId, "应返回 publicationId");
    state.publicationA1Id = publishBody1.publicationId;

    const query = `objectType=scoped_record&objectId=${encodeURIComponent(state.recordAId!)}`;
    const read = await anonymousClient.get(`/api/publications?${query}`);
    assert.equal(read.status, 200, `公开读失败: ${JSON.stringify(read.data)}`);
    assertNoStore(read.headers, "公开读");
    const publication = (read.data as { publication: Record<string, unknown> }).publication;
    assert.equal(publication.version, 1);
    assert.equal(publication.status, "PUBLISHED");
    assert.equal(publication.objectType, "scoped_record");
    assert.equal(publication.objectId, state.recordAId);
    assert.equal((publication.projectionJson as { marker?: string }).marker, markerV1);

    const readV1 = await anonymousClient.get(`/api/publications?${query}&version=1`);
    assert.equal(readV1.status, 200, `version=1 读取失败: ${JSON.stringify(readV1.data)}`);
    assertNoStore(readV1.headers, "version=1 读");
    assert.equal((readV1.data as { publication: { version?: number } }).publication.version, 1);
  });

  test("幂等与冲突：同内容重发 201 deduplicated=true；同版本异内容 409", async (t) => {
    skipUnlessReady(t);

    const replay = await ownerClient.post("/api/publications", publishBody(state.recordAId!, 1, projectionV1()));
    assert.equal(replay.status, 201, `同内容重发必须幂等: ${JSON.stringify(replay.data)}`);
    assert.equal((replay.data as { deduplicated: boolean }).deduplicated, true);
    assert.equal((replay.data as { publicationId: string }).publicationId, state.publicationA1Id, "重发应返回同一 publicationId");

    const conflict = await ownerClient.post(
      "/api/publications",
      publishBody(state.recordAId!, 1, { title: "tampered projection", marker: "TAMPERED" }),
    );
    assert.equal(conflict.status, 409, "同版本异内容必须 409");
    assert.equal((conflict.data as { code?: string }).code, "PUBLICATION_CONFLICT");
  });

  test("发新版 v2：默认读返回 v2，?version=1 仍返回 v1", async (t) => {
    skipUnlessReady(t);

    const publishV2 = await ownerClient.post(
      "/api/publications",
      publishBody(state.recordAId!, 2, { title: `Public A v2 ${suffix}`, marker: markerV2 }),
    );
    assert.equal(publishV2.status, 201, `发布 v2 失败: ${JSON.stringify(publishV2.data)}`);
    assert.equal((publishV2.data as { deduplicated: boolean }).deduplicated, false);

    const query = `objectType=scoped_record&objectId=${encodeURIComponent(state.recordAId!)}`;
    const readDefault = await anonymousClient.get(`/api/publications?${query}`);
    assert.equal(readDefault.status, 200);
    assert.equal((readDefault.data as { publication: { version?: number } }).publication.version, 2, "默认读应返回最新已发布版本 v2");

    const readV1 = await anonymousClient.get(`/api/publications?${query}&version=1`);
    assert.equal(readV1.status, 200, "旧版本 v1 不得被下架");
    assert.equal((readV1.data as { publication: { version?: number; status?: string } }).publication.version, 1);
  });

  test("撤回 v2：404+no-store，v1 仍可读，重复撤回幂等，outsider 撤回 403", async (t) => {
    skipUnlessReady(t);

    const withdraw = await ownerClient.post("/api/publications/withdraw", {
      objectType: "scoped_record",
      objectId: state.recordAId,
      version: 2,
    });
    assert.equal(withdraw.status, 200, `撤回 v2 失败: ${JSON.stringify(withdraw.data)}`);
    assert.ok((withdraw.data as { publicationId?: string }).publicationId);

    const query = `objectType=scoped_record&objectId=${encodeURIComponent(state.recordAId!)}`;
    const readV2 = await anonymousClient.get(`/api/publications?${query}&version=2`);
    assert.equal(readV2.status, 404, "已撤回版本必须 404");
    assert.equal((readV2.data as { code?: string }).code, "PUBLICATION_NOT_FOUND");
    assertNoStore(readV2.headers, "已撤回版本读");

    const readDefault = await anonymousClient.get(`/api/publications?${query}`);
    assert.equal(readDefault.status, 200, "默认读返回最新 PUBLISHED 版本（v1 仍发布）");
    assert.equal((readDefault.data as { publication: { version?: number } }).publication.version, 1);

    const readV1 = await anonymousClient.get(`/api/publications?${query}&version=1`);
    assert.equal(readV1.status, 200, "撤回 v2 不得波及其他版本");

    const withdrawAgain = await ownerClient.post("/api/publications/withdraw", {
      objectType: "scoped_record",
      objectId: state.recordAId,
      version: 2,
    });
    assert.equal(withdrawAgain.status, 200, "重复撤回必须幂等 200");

    const outsiderWithdraw = await outsiderClient.post("/api/publications/withdraw", {
      objectType: "scoped_record",
      objectId: state.recordAId,
      version: 1,
    });
    assert.equal(outsiderWithdraw.status, 403, "outsider 撤回必须 403");
    assert.equal((outsiderWithdraw.data as { code?: string }).code, "RECORD_ACCESS_DENIED");
  });

  test("恢复保护：撤回版本不可重发；发 v3 成功且默认读返回 v3", async (t) => {
    skipUnlessReady(t);

    const restore = await ownerClient.post(
      "/api/publications",
      publishBody(state.recordAId!, 2, { title: `Public A v2 ${suffix}`, marker: markerV2 }),
    );
    assert.equal(restore.status, 409, "已撤回版本禁止重新发布");
    assert.equal((restore.data as { code?: string }).code, "PUBLICATION_RESTORE_FORBIDDEN");

    const publishV3 = await ownerClient.post(
      "/api/publications",
      publishBody(state.recordAId!, 3, { title: `Public A v3 ${suffix}`, marker: markerV3 }),
    );
    assert.equal(publishV3.status, 201, `发布 v3 失败: ${JSON.stringify(publishV3.data)}`);

    const query = `objectType=scoped_record&objectId=${encodeURIComponent(state.recordAId!)}`;
    const readDefault = await anonymousClient.get(`/api/publications?${query}`);
    assert.equal(readDefault.status, 200);
    assert.equal((readDefault.data as { publication: { version?: number } }).publication.version, 3);

    const readV2 = await anonymousClient.get(`/api/publications?${query}&version=2`);
    assert.equal(readV2.status, 404, "v3 发布后 v2 仍保持撤回状态");
    assert.equal((readV2.data as { code?: string }).code, "PUBLICATION_NOT_FOUND");
  });

  test("唯一版本撤回：默认读 fail-closed 404 且 no-store", async (t) => {
    skipUnlessReady(t);

    const publish = await ownerClient.post(
      "/api/publications",
      publishBody(state.recordDId!, 1, { title: `Public D v1 ${suffix}`, marker: `PUB_MARKER_D_${suffix}` }),
    );
    assert.equal(publish.status, 201, `发布 D v1 失败: ${JSON.stringify(publish.data)}`);

    const withdraw = await ownerClient.post("/api/publications/withdraw", {
      objectType: "scoped_record",
      objectId: state.recordDId,
      version: 1,
    });
    assert.equal(withdraw.status, 200, `撤回 D v1 失败: ${JSON.stringify(withdraw.data)}`);

    const query = `objectType=scoped_record&objectId=${encodeURIComponent(state.recordDId!)}`;
    const readDefault = await anonymousClient.get(`/api/publications?${query}`);
    assert.equal(readDefault.status, 404, "唯一版本撤回后默认读必须 404");
    assert.equal((readDefault.data as { code?: string }).code, "PUBLICATION_NOT_FOUND");
    assertNoStore(readDefault.headers, "撤回后默认读");

    const readV1 = await anonymousClient.get(`/api/publications?${query}&version=1`);
    assert.equal(readV1.status, 404);
    assertNoStore(readV1.headers, "撤回后版本读");
  });

  test("同意门：无同意 403 CONSENT_REQUIRED，授予后 201，撤回后 403 CONSENT_WITHDRAWN", async (t) => {
    skipUnlessReady(t);

    state.recordBId = await createRecord(`pub_b_${suffix}`, `Publication Record B ${suffix}`, `SECRET_B_${suffix}`);
    const requirements = { consentRequirements: [{ subjectUserId: state.consentingUserId, purpose: "image_use" }] };
    const projection = { title: `Public B v1 ${suffix}`, marker: `PUB_MARKER_B1_${suffix}` };

    const withoutConsent = await ownerClient.post(
      "/api/publications",
      publishBody(state.recordBId, 1, projection, requirements),
    );
    assert.equal(withoutConsent.status, 403, "缺少必要同意必须 403");
    assert.equal((withoutConsent.data as { code?: string }).code, "CONSENT_REQUIRED");

    const grant = await consentingClient.post("/api/consents", {
      subjectUserId: state.consentingUserId,
      purpose: "image_use",
    });
    assert.equal(grant.status, 201, `授予同意失败: ${JSON.stringify(grant.data)}`);
    state.consentId = (grant.data as { consentId: string }).consentId;
    assert.ok(state.consentId, "应返回 consentId");

    const withConsent = await ownerClient.post(
      "/api/publications",
      publishBody(state.recordBId, 1, projection, requirements),
    );
    assert.equal(withConsent.status, 201, `同意有效后发布必须成功: ${JSON.stringify(withConsent.data)}`);
    assert.equal((withConsent.data as { deduplicated: boolean }).deduplicated, false);

    const withdraw = await consentingClient.post(`/api/consents/${state.consentId}/withdraw`, {});
    assert.equal(withdraw.status, 200, `撤回同意失败: ${JSON.stringify(withdraw.data)}`);

    const afterWithdraw = await ownerClient.post(
      "/api/publications",
      publishBody(state.recordBId, 2, { title: `Public B v2 ${suffix}`, marker: `PUB_MARKER_B2_${suffix}` }, requirements),
    );
    assert.equal(afterWithdraw.status, 403, "同意撤回后必须阻断新版本发布");
    assert.equal((afterWithdraw.data as { code?: string }).code, "CONSENT_WITHDRAWN");
  });

  test("批准回执门：approvalReceipt 强制 APPROVED 回执，REJECTED/撤销阻断发布", async (t) => {
    skipUnlessReady(t);
    // 门路径：approvalReceipt:true 时发布前必须存在该版本及以上 APPROVED 回执
    // （CP-FR-061 只发布批准版本）；REJECTED 或更高 revision 的 REVOKED 视为无有效批准。
    state.recordCId = await createRecord(`pub_c_${suffix}`, `Publication Record C ${suffix}`, `SECRET_C_${suffix}`);

    const gatedV1 = await ownerClient.post(
      "/api/publications",
      publishBody(state.recordCId, 1, { title: `Public C v1 ${suffix}`, marker: `PUB_MARKER_C1_${suffix}` }, { approvalReceipt: true }),
    );
    assert.equal(gatedV1.status, 403, "无批准回执时 approvalReceipt 门必须拒绝");
    assert.equal((gatedV1.data as { code?: string }).code, "RECEIPT_ISSUER_UNVERIFIED");

    const receipt = await machineClient.post(
      "/api/v1/open/decision-receipts",
      {
        objectType: "scoped_record",
        objectId: state.recordCId,
        objectRevision: 1,
        purpose: "publication_approval",
        decision: "APPROVED",
        minimalJson: { ref: `approval-${suffix}` },
        idempotencyKey: `pub-approval-${suffix}`,
      },
      openBearer(),
    );
    assert.equal(receipt.status, 201, `提交批准回执失败: ${JSON.stringify(receipt.data)}`);
    assert.equal((receipt.data as { deduplicated: boolean }).deduplicated, false);

    const publishV1 = await ownerClient.post(
      "/api/publications",
      publishBody(state.recordCId, 1, { title: `Public C v1 ${suffix}`, marker: `PUB_MARKER_C1_${suffix}` }, { approvalReceipt: true }),
    );
    assert.equal(publishV1.status, 201, "存在达标 APPROVED 回执后门路径发布必须成功");

    const rejected = await machineClient.post(
      "/api/v1/open/decision-receipts",
      {
        objectType: "scoped_record",
        objectId: state.recordCId,
        objectRevision: 2,
        purpose: "publication_approval",
        decision: "REJECTED",
        minimalJson: { ref: `rejection-${suffix}` },
        idempotencyKey: `pub-rejection-${suffix}`,
      },
      openBearer(),
    );
    assert.equal(rejected.status, 201);

    const gatedV2 = await ownerClient.post(
      "/api/publications",
      publishBody(state.recordCId, 2, { title: `Public C v2 ${suffix}`, marker: `PUB_MARKER_C2_${suffix}` }, { approvalReceipt: true }),
    );
    assert.equal(gatedV2.status, 403, "最新回执为 REJECTED 时门必须拒绝");
    assert.equal((gatedV2.data as { code?: string }).code, "RECEIPT_ISSUER_UNVERIFIED");

    const publishV2NoGate = await ownerClient.post(
      "/api/publications",
      publishBody(state.recordCId, 2, { title: `Public C v2 ${suffix}`, marker: `PUB_MARKER_C2_${suffix}` }),
    );
    assert.equal(publishV2NoGate.status, 201, "approvalReceipt 非默认，无门路径不受回执影响");
  });

  test("dispatch 扇出：published/withdrawn 入队且 payload 不含投影正文", async (t) => {
    skipUnlessReady(t);
    const client = await db();

    const published = await client.outboundDispatch.findMany({
      where: {
        eventType: "publication.published",
        channelClientId: state.machineClientDbId,
        payloadJson: { path: ["objectId"], equals: state.recordAId },
      },
    });
    assert.ok(published.length >= 1, "发布后必须存在 publication.published 出站事件");
    for (const row of published) {
      assert.equal(row.status, "PENDING");
      const payload = row.payloadJson as Record<string, unknown>;
      assert.equal(payload.objectType, "scoped_record");
      assert.equal(payload.objectId, state.recordAId);
      assert.equal(typeof payload.projectionHash, "string", "payload 应只含投影哈希");
      assert.equal("projectionJson" in payload, false, "payload 不得包含 projectionJson 正文");
      const raw = JSON.stringify(row.payloadJson);
      assert.equal(raw.includes(markerV1), false, "payload 不得泄漏 v1 投影正文");
      assert.equal(raw.includes(markerV2), false, "payload 不得泄漏 v2 投影正文");
      assert.equal(raw.includes(markerV3), false, "payload 不得泄漏 v3 投影正文");
    }

    const withdrawn = await client.outboundDispatch.findFirst({
      where: {
        eventType: "publication.withdrawn",
        channelClientId: state.machineClientDbId,
        payloadJson: { path: ["objectId"], equals: state.recordAId },
      },
    });
    assert.ok(withdrawn, "撤回后必须存在 publication.withdrawn 出站事件");
    const withdrawnPayload = withdrawn.payloadJson as Record<string, unknown>;
    assert.equal(withdrawnPayload.version, 2);
    assert.equal(withdrawnPayload.status, "WITHDRAWN");
    assert.equal(JSON.stringify(withdrawn.payloadJson).includes(markerV2), false);
  });

  test("审计：publication.publish / publication.withdraw 落库", async (t) => {
    skipUnlessReady(t);
    const client = await db();
    const audits = await client.coreAuditLog.findMany({
      where: {
        createdAt: { gte: runStartedAt },
        action: { in: ["publication.publish", "publication.withdraw"] },
        subjectId: state.recordAId,
      },
    });
    const actions = new Set(audits.map((audit) => audit.action));
    assert.equal(actions.has("publication.publish"), true, "缺少 publication.publish 审计");
    assert.equal(actions.has("publication.withdraw"), true, "缺少 publication.withdraw 审计");
    const publishVersions = audits
      .filter((audit) => audit.action === "publication.publish")
      .map((audit) => (audit.metadataJson as { version?: number }).version);
    for (const version of [1, 2, 3]) {
      assert.equal(publishVersions.includes(version), true, `缺少 v${version} 发布审计`);
    }
  });
});
