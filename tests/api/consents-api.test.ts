/**
 * API 集成测试：多目的同意、监护链接、撤回（CP-TODO-249 / CP-FR-060）
 *
 * 覆盖（真实数据库 + 真实会话）：
 * - 本人自授：POST /api/consents {subjectUserId: 自己} 201 {consentId, version:1}；
 *   同范围再授 → version 2，列表可见旧条 SUPERSEDED、新条 ACTIVE
 * - 目的分离：授 image_use 后 ?purpose=contact 列表为空（不能推出其他目的已授）
 * - 监护规则（actor=grantor，subjectUserId=owner）：无 guardianUserId → 400
 *   GUARDIAN_LINK_REQUIRED；guardianUserId=grantor 但无 evidenceJson → 400；
 *   guardianUserId=另一人 → 400；合规 {guardianUserId: grantor, evidenceJson} → 201
 * - 有效期窗口：validUntil 早于 validFrom 的授予 400
 * - 撤回：outsider POST /api/consents/[id]/withdraw 403；subject 撤回 200；
 *   再撤回 409 CONSENT_WITHDRAWN；grantor（原授予人）撤回另一条 200
 * - 列表：GET /api/consents 默认本人 200；?purpose= 过滤生效；
 *   outsider 查询他人 subjectUserId → 403
 * - 频道与对象：授 {purpose: endorsement, channel: FS_PUBLIC} 后列表可见 channel
 *   归一落库为小写 fs_public
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

const ownerClient = new ApiClient(baseURL);
const grantorClient = new ApiClient(baseURL);
const outsiderClient = new ApiClient(baseURL);

const state: {
  ownerId?: string;
  grantorId?: string;
  outsiderId?: string;
  programmeId?: string;
  imageUseConsentId?: string;
  guardianConsentId?: string;
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
    t.skip("账号未验证邮箱，跳过同意测试");
    return false;
  }
  assert.equal(response.status, 200, `登录失败 (${email}): ${JSON.stringify(response.data)}`);
  return true;
}

before(async () => {
  serverReady = await waitForServer(baseURL, 30000);
});

describe("多目的同意与监护链接（CP-TODO-249）", () => {
  test("准备：owner/grantor/outsider 账号 + tenant+programme", async (t) => {
    skipUnlessReady(t);

    const client = await db();
    const passwordHash = await hash("seeded-password", 10);
    const emails = {
      owner: `consent_owner_${suffix}@example.com`,
      grantor: `consent_grantor_${suffix}@example.com`,
      outsider: `consent_outsider_${suffix}@example.com`,
    };
    const [owner, grantor, outsider] = await Promise.all([
      createUser(client, emails.owner, "Consent Owner", passwordHash),
      createUser(client, emails.grantor, "Consent Grantor", passwordHash),
      createUser(client, emails.outsider, "Consent Outsider", passwordHash),
    ]);
    state.ownerId = owner.id;
    state.grantorId = grantor.id;
    state.outsiderId = outsider.id;
    assert.ok(await login(ownerClient, emails.owner, t));
    assert.ok(await login(grantorClient, emails.grantor, t));
    assert.ok(await login(outsiderClient, emails.outsider, t));

    const tenant = await client.tenant.create({
      data: { key: `consent-tenant-${suffix}`, name: `Consent Tenant ${suffix}` },
      select: { id: true },
    });
    const programme = await client.programme.create({
      data: { key: `consent-prog-${suffix}`, name: `Consent Programme ${suffix}`, tenantId: tenant.id },
      select: { id: true },
    });
    state.programmeId = programme.id;
  });

  test("本人自授：v1 建立，同范围再授 v2 取代（旧 SUPERSEDED 新 ACTIVE）", async (t) => {
    skipUnlessReady(t);

    const first = await ownerClient.post("/api/consents", {
      subjectUserId: state.ownerId,
      purpose: "image_use",
    });
    assert.equal(first.status, 201, `本人自授失败: ${JSON.stringify(first.data)}`);
    state.imageUseConsentId = (first.data as { consentId: string }).consentId;
    assert.equal((first.data as { version: number }).version, 1, "首次授予应为 version=1");

    const second = await ownerClient.post("/api/consents", {
      subjectUserId: state.ownerId,
      purpose: "image_use",
    });
    assert.equal(second.status, 201, `同范围再授失败: ${JSON.stringify(second.data)}`);
    assert.equal((second.data as { version: number }).version, 2, "同范围再授应产生 version=2");
    state.imageUseConsentId = (second.data as { consentId: string }).consentId;

    const list = await ownerClient.get("/api/consents");
    assert.equal(list.status, 200);
    const imageUse = (list.data as { consents: Array<{ purpose: string; version: number; status: string }> }).consents
      .filter((consent) => consent.purpose === "image_use");
    assert.equal(imageUse.length, 2, "同范围应保留两个版本");
    assert.equal(imageUse.find((consent) => consent.version === 1)?.status, "SUPERSEDED", "旧版本应为 SUPERSEDED");
    assert.equal(imageUse.find((consent) => consent.version === 2)?.status, "ACTIVE", "新版本应为 ACTIVE");
  });

  test("目的分离：授 image_use 不得推出 contact 已授", async (t) => {
    skipUnlessReady(t);

    const contact = await ownerClient.get("/api/consents?purpose=contact");
    assert.equal(contact.status, 200);
    assert.deepEqual(
      (contact.data as { consents: unknown[] }).consents,
      [],
      "仅授 image_use 时 purpose=contact 的列表必须为空",
    );
  });

  test("监护代授矩阵：guardian 声明/证据/一致性 400，合规 201", async (t) => {
    skipUnlessReady(t);

    const noGuardian = await grantorClient.post("/api/consents", {
      subjectUserId: state.ownerId,
      purpose: "contact",
    });
    assert.equal(noGuardian.status, 400, "代授缺少 guardianUserId 必须 400");
    assert.equal((noGuardian.data as { code: string }).code, "GUARDIAN_LINK_REQUIRED");

    const noEvidence = await grantorClient.post("/api/consents", {
      subjectUserId: state.ownerId,
      purpose: "contact",
      guardianUserId: state.grantorId,
    });
    assert.equal(noEvidence.status, 400, "代授缺少 evidenceJson 必须 400");
    assert.equal((noEvidence.data as { code: string }).code, "GUARDIAN_LINK_REQUIRED");

    const wrongGuardian = await grantorClient.post("/api/consents", {
      subjectUserId: state.ownerId,
      purpose: "contact",
      guardianUserId: state.outsiderId,
      evidenceJson: { verificationRef: `guardian-verify-wrong-${suffix}` },
    });
    assert.equal(wrongGuardian.status, 400, "guardianUserId 与授予人不一致必须 400");
    assert.equal((wrongGuardian.data as { code: string }).code, "GUARDIAN_LINK_REQUIRED");

    const granted = await grantorClient.post("/api/consents", {
      subjectUserId: state.ownerId,
      purpose: "contact",
      guardianUserId: state.grantorId,
      evidenceJson: { verificationRef: `guardian-verify-${suffix}` },
      programmeId: state.programmeId,
    });
    assert.equal(granted.status, 201, `合规监护代授失败: ${JSON.stringify(granted.data)}`);
    state.guardianConsentId = (granted.data as { consentId: string }).consentId;
    assert.equal((granted.data as { version: number }).version, 1);
  });

  test("有效期窗口：validUntil 早于 validFrom 的授予 400", async (t) => {
    skipUnlessReady(t);

    const expired = await ownerClient.post("/api/consents", {
      subjectUserId: state.ownerId,
      purpose: "programme_operation",
      validFrom: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      validUntil: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    });
    assert.equal(expired.status, 400, "validUntil 早于 validFrom 必须 400");
    assert.equal((expired.data as { code: string }).code, "INVALID_REQUEST");
  });

  test("频道归一：endorsement + FS_PUBLIC 落库为小写 fs_public", async (t) => {
    skipUnlessReady(t);

    const grant = await ownerClient.post("/api/consents", {
      subjectUserId: state.ownerId,
      purpose: "endorsement",
      channel: "FS_PUBLIC",
    });
    assert.equal(grant.status, 201, `频道授予失败: ${JSON.stringify(grant.data)}`);

    const list = await ownerClient.get("/api/consents?purpose=endorsement");
    assert.equal(list.status, 200);
    const consents = (list.data as { consents: Array<{ channel: string | null }> }).consents;
    assert.equal(consents.length, 1);
    assert.equal(consents[0].channel, "fs_public", "channel 必须归一为小写落库");
  });

  test("撤回矩阵：outsider 403，subject 200，重复 409，grantor 撤另一条 200", async (t) => {
    skipUnlessReady(t);

    const outsiderWithdraw = await outsiderClient.post(`/api/consents/${state.imageUseConsentId}/withdraw`, {});
    assert.equal(outsiderWithdraw.status, 403, "outsider 撤回必须 403");

    const subjectWithdraw = await ownerClient.post(`/api/consents/${state.imageUseConsentId}/withdraw`, {});
    assert.equal(subjectWithdraw.status, 200, `subject 撤回失败: ${JSON.stringify(subjectWithdraw.data)}`);

    const again = await ownerClient.post(`/api/consents/${state.imageUseConsentId}/withdraw`, {});
    assert.equal(again.status, 409, "重复撤回必须 409");
    assert.equal((again.data as { code: string }).code, "CONSENT_WITHDRAWN");

    const grantorWithdraw = await grantorClient.post(`/api/consents/${state.guardianConsentId}/withdraw`, {});
    assert.equal(grantorWithdraw.status, 200, `授予人（监护人）撤回失败: ${JSON.stringify(grantorWithdraw.data)}`);
  });

  test("列表：默认本人，purpose 过滤生效，outsider 查他人 403", async (t) => {
    skipUnlessReady(t);

    const mine = await ownerClient.get("/api/consents");
    assert.equal(mine.status, 200);
    const mineConsents = (mine.data as { consents: Array<{ purpose: string; status: string }> }).consents;
    assert.ok(
      mineConsents.some((consent) => consent.purpose === "image_use" && consent.status === "WITHDRAWN"),
      "列表应包含已撤回的 image_use",
    );
    assert.ok(
      mineConsents.some((consent) => consent.purpose === "endorsement" && consent.status === "ACTIVE"),
      "列表应包含 ACTIVE 的 endorsement",
    );

    const filtered = await ownerClient.get("/api/consents?purpose=endorsement");
    assert.equal(filtered.status, 200);
    const filteredConsents = (filtered.data as { consents: Array<{ purpose: string }> }).consents;
    assert.ok(filteredConsents.length > 0, "purpose=endorsement 过滤应有结果");
    assert.ok(
      filteredConsents.every((consent) => consent.purpose === "endorsement"),
      "purpose 过滤必须只返回匹配目的",
    );

    const crossSubject = await outsiderClient.get(`/api/consents?subjectUserId=${state.ownerId}`);
    assert.equal(crossSubject.status, 403, "非本人非授予人查询他人同意必须 403");
  });
});
