/**
 * API 集成测试：Person 认领 / 机构代表权 / 合并别名 / 授权投影（CP-TODO-242 / CP-FR-051/052）
 *
 * 覆盖（真实数据库 + 真实会话）：
 * - 机构上下文读取：匿名 401；仅有任职关系（PersonAffiliation）的用户 403（任职≠授权）；
 *   有效代表权（READ）200 且返回用途受限投影（内部字段不泄漏）
 * - 代表权委托链：READ 持有者不能授权（403）；MANAGE 持有者可代机构授予（201）
 * - 撤销：立即生效（再读 403），compare-and-set（二次撤销 409），过期窗口拒绝
 * - 认领：仅 VERIFIED 且未关联账号可认领；投影不含 orcid/bio 等内部字段；重复认领 409
 * - 合并：机构/Person 源 id 在消费端与管理端读取均可解析到规范记录
 * - 关键审计：grant/revoke/claim/merge 均落 core_audit_logs
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
const repReaderClient = new ApiClient(baseURL);
const repManagerClient = new ApiClient(baseURL);
const affiliatedClient = new ApiClient(baseURL);
const claimerClient = new ApiClient(baseURL);
const expiredClient = new ApiClient(baseURL);
const anonymousClient = new ApiClient(baseURL);

const state: {
  programmeKey?: string;
  institutionId?: string;
  institutionName?: string;
  duplicateInstitutionId?: string;
  personId?: string;
  duplicatePersonId?: string;
  readerRepresentationId?: string;
  readerEmail?: string;
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
    t.skip("账号未验证邮箱，跳过治理测试");
    return false;
  }
  assert.equal(response.status, 200, `登录失败 (${email}): ${JSON.stringify(response.data)}`);
  return true;
}

before(async () => {
  serverReady = await waitForServer(baseURL, 30000);
});

describe("Person/Institution 治理（CP-TODO-242）", () => {
  test("准备：Programme/机构/账号/任职关系", async (t) => {
    skipUnlessReady(t);
    const seeded = testData.seededUsers;
    assert.ok(await login(adminClient, seeded.admin.email, t));

    const client = await db();
    const passwordHash = await hash("seeded-password", 10);
    const emails = {
      reader: `gov_reader_${suffix}@example.com`,
      manager: `gov_manager_${suffix}@example.com`,
      affiliated: `gov_affiliated_${suffix}@example.com`,
      claimer: `gov_claimer_${suffix}@example.com`,
      expired: `gov_expired_${suffix}@example.com`,
    };
    state.readerEmail = emails.reader;
    const [, , affiliated] = await Promise.all([
      createUser(client, emails.reader, "Governance Reader", passwordHash),
      createUser(client, emails.manager, "Governance Manager", passwordHash),
      createUser(client, emails.affiliated, "Governance Affiliated", passwordHash),
      createUser(client, emails.claimer, "Governance Claimer", passwordHash),
      createUser(client, emails.expired, "Governance Expired", passwordHash),
    ]);
    assert.ok(await login(repReaderClient, emails.reader, t));
    assert.ok(await login(repManagerClient, emails.manager, t));
    assert.ok(await login(affiliatedClient, emails.affiliated, t));
    assert.ok(await login(claimerClient, emails.claimer, t));
    assert.ok(await login(expiredClient, emails.expired, t));

    const tenant = await client.tenant.create({
      data: { key: `gov-tenant-${suffix}`, name: `Governance Tenant ${suffix}` },
      select: { id: true },
    });
    const programme = await client.programme.create({
      data: { key: `gov-prog-${suffix}`, name: `Governance Programme ${suffix}`, tenantId: tenant.id },
      select: { id: true, key: true },
    });
    state.programmeKey = programme.key;
    await client.edition.create({ data: { programmeId: programme.id, key: "2026", name: "Governance 2026" } });

    const institution = await client.institution.create({
      data: {
        slug: `gov-inst-${suffix}`,
        name: `Governance Institution ${suffix}`,
        nameEn: `Governance Institution ${suffix}`,
        publicContactEmail: "internal-contact@example.com",
        legalName: "Governance Legal Name Ltd",
        headquartersAddress: "Internal HQ Address",
        verificationStatus: "VERIFIED",
      },
      select: { id: true, name: true },
    });
    state.institutionId = institution.id;
    state.institutionName = institution.name;

    // 任职关系：不构成代表权（CP-FR-051 负向矩阵前置）
    const affiliatedPerson = await client.person.create({
      data: { displayName: `Affiliated Person ${suffix}`, verificationStatus: "VERIFIED" },
      select: { id: true },
    });
    await client.personAffiliation.create({
      data: { personId: affiliatedPerson.id, institutionId: institution.id, title: "Staff", isCurrent: true },
    });
    // affiliated 用户经由其 Person 记录与该机构形成任职关系（仍不构成代表权）
    await client.person.update({ where: { id: affiliatedPerson.id }, data: { userId: affiliated.id } });
  });

  test("机构上下文读取：匿名 401，仅任职关系 403，无授权 403", async (t) => {
    skipUnlessReady(t);

    const anonymous = await anonymousClient.get(`/api/institutions/${state.institutionId}`);
    assert.equal(anonymous.status, 401, "匿名访问必须 401");

    const affiliated = await affiliatedClient.get(`/api/institutions/${state.institutionId}`);
    assert.equal(affiliated.status, 403, "仅有任职/雇佣关系的用户不得获得机构上下文（任职≠授权）");

    const unauthorized = await repReaderClient.get(`/api/institutions/${state.institutionId}`);
    assert.equal(unauthorized.status, 403);
  });

  test("授予 READ 代表权后读取通过，且返回用途受限投影", async (t) => {
    skipUnlessReady(t);
    const grant = await adminClient.post(`/api/admin/institutions/${state.institutionId}/representations`, {
      userEmail: state.readerEmail,
      programmeKey: state.programmeKey,
      actionScope: ["READ"],
      basis: { reason: "governance test" },
    });
    assert.equal(grant.status, 201, `授予代表权失败: ${JSON.stringify(grant.data)}`);
    state.readerRepresentationId = (grant.data as { representationId: string }).representationId;
    assert.ok(state.readerRepresentationId, "应返回 representationId");

    const read = await repReaderClient.get(`/api/institutions/${state.institutionId}`);
    assert.equal(read.status, 200, `代表权读取失败: ${JSON.stringify(read.data)}`);
    const institution = (read.data as { institution: Record<string, unknown> }).institution;
    assert.equal(institution.name, state.institutionName);
    assert.equal(institution.verificationStatus, "VERIFIED");
    for (const internalField of ["publicContactEmail", "legalName", "headquartersAddress"]) {
      assert.equal(internalField in institution, false, `${internalField} 不得出现在用途受限投影中`);
    }
    const rawBody = JSON.stringify(read.data);
    assert.equal(rawBody.includes("internal-contact@example.com"), false, "内部联系邮箱不得泄漏");
    assert.equal(rawBody.includes("Internal HQ Address"), false);
  });

  test("代表权委托链：READ 不能授权，MANAGE 可代机构授予", async (t) => {
    skipUnlessReady(t);

    const readerGrants = await repReaderClient.post(`/api/admin/institutions/${state.institutionId}/representations`, {
      userEmail: `gov_claimer_${suffix}@example.com`,
      programmeKey: state.programmeKey,
      actionScope: ["READ"],
    });
    assert.equal(readerGrants.status, 403, "READ 范围代表人无权再授权");

    const manageGrant = await adminClient.post(`/api/admin/institutions/${state.institutionId}/representations`, {
      userEmail: `gov_manager_${suffix}@example.com`,
      programmeKey: state.programmeKey,
      actionScope: ["MANAGE"],
    });
    assert.equal(manageGrant.status, 201, `授予 MANAGE 失败: ${JSON.stringify(manageGrant.data)}`);

    const delegated = await repManagerClient.post(`/api/admin/institutions/${state.institutionId}/representations`, {
      userEmail: `gov_claimer_${suffix}@example.com`,
      programmeKey: state.programmeKey,
      actionScope: ["READ"],
    });
    assert.equal(delegated.status, 201, `MANAGE 代表人代机构授予失败: ${JSON.stringify(delegated.data)}`);
  });

  test("撤销立即生效且 compare-and-set；过期窗口拒绝", async (t) => {
    skipUnlessReady(t);

    const revoke = await adminClient.post(`/api/admin/institutions/representations/${state.readerRepresentationId}/revoke`, {
      reason: "governance test offboarding",
    });
    assert.equal(revoke.status, 200, `撤销失败: ${JSON.stringify(revoke.data)}`);

    const afterRevoke = await repReaderClient.get(`/api/institutions/${state.institutionId}`);
    assert.equal(afterRevoke.status, 403, "撤销后旧访问必须立即失效");

    const secondRevoke = await adminClient.post(`/api/admin/institutions/representations/${state.readerRepresentationId}/revoke`, {});
    assert.equal(secondRevoke.status, 409, "重复撤销必须 409");

    const client = await db();
    const expiredUser = await client.user.findUniqueOrThrow({ where: { email: `gov_expired_${suffix}@example.com` }, select: { id: true } });
    await client.institutionRepresentation.create({
      data: {
        institutionId: state.institutionId!,
        userId: expiredUser.id,
        programmeId: (await client.programme.findFirstOrThrow({ where: { key: state.programmeKey! } })).id,
        actionScope: ["READ"],
        validUntil: new Date(Date.now() - 60_000),
        status: "ACTIVE",
      },
    });
    const expiredRead = await expiredClient.get(`/api/institutions/${state.institutionId}`);
    assert.equal(expiredRead.status, 403, "有效期窗口外的代表权必须拒绝");
  });

  test("认领：VERIFIED 未关联账号可认领，投影受限，重复认领 409", async (t) => {
    skipUnlessReady(t);

    const personCreate = await adminClient.post("/api/admin/people", {
      displayName: `Governance Person ${suffix}`,
      displayNameEn: `Governance Person ${suffix}`,
      orcid: "0000-0002-INTERNAL",
      bio: "internal biography that must not leak",
      verificationStatus: "VERIFIED",
    });
    assert.ok([200, 201].includes(personCreate.status), `创建 Person 失败: ${JSON.stringify(personCreate.data)}`);
    state.personId = (personCreate.data as { person?: { id: string } }).person?.id
      ?? (personCreate.data as { id?: string }).id;
    assert.ok(state.personId, "应返回 person id");

    const claim = await claimerClient.post(`/api/people/${state.personId}/claim`, {});
    assert.equal(claim.status, 200, `认领失败: ${JSON.stringify(claim.data)}`);
    const person = (claim.data as { person: Record<string, unknown> }).person;
    assert.equal(person.displayName, `Governance Person ${suffix}`);
    for (const internalField of ["orcid", "bio"]) {
      assert.equal(internalField in person, false, `${internalField} 不得出现在 person_identity 投影中`);
    }
    assert.equal(JSON.stringify(claim.data).includes("INTERNAL"), false);

    const secondClaim = await repReaderClient.post(`/api/people/${state.personId}/claim`, {});
    assert.equal(secondClaim.status, 409, "已认领 Person 不得重复认领");

    const draftCreate = await adminClient.post("/api/admin/people", {
      displayName: `Governance Draft Person ${suffix}`,
      verificationStatus: "DRAFT",
    });
    const draftPersonId = (draftCreate.data as { person?: { id: string } }).person?.id
      ?? (draftCreate.data as { id?: string }).id;
    const draftClaim = await repManagerClient.post(`/api/people/${draftPersonId}/claim`, {});
    assert.equal(draftClaim.status, 409, "未确认（DRAFT）Person 不得认领");
  });

  test("合并：机构与 Person 的旧 id 在原引用处可解析", async (t) => {
    skipUnlessReady(t);

    const client = await db();
    const duplicate = await client.institution.create({
      data: { slug: `gov-inst-dup-${suffix}`, name: `Governance Duplicate ${suffix}`, verificationStatus: "VERIFIED" },
      select: { id: true },
    });
    state.duplicateInstitutionId = duplicate.id;

    const merge = await adminClient.post(`/api/admin/institutions/${state.institutionId}/merge`, {
      sourceId: state.duplicateInstitutionId,
    });
    assert.equal(merge.status, 200, `机构合并失败: ${JSON.stringify(merge.data)}`);

    const byOldId = await repManagerClient.get(`/api/institutions/${state.duplicateInstitutionId}`);
    assert.equal(byOldId.status, 200, "合并源 id 必须仍可解析");
    assert.equal((byOldId.data as { institution: { name?: string } }).institution?.name, state.institutionName);

    const adminByOldId = await adminClient.get(`/api/admin/institutions/${state.duplicateInstitutionId}`);
    assert.equal(adminByOldId.status, 200, "管理端按旧 id 读取应解析到规范记录");

    const dupPerson = await adminClient.post("/api/admin/people", {
      displayName: `Governance Duplicate Person ${suffix}`,
      verificationStatus: "VERIFIED",
    });
    state.duplicatePersonId = (dupPerson.data as { person?: { id: string } }).person?.id
      ?? (dupPerson.data as { id?: string }).id;
    const personMerge = await adminClient.post(`/api/admin/people/${state.personId}/merge`, {
      sourceId: state.duplicatePersonId,
    });
    assert.equal(personMerge.status, 200, `Person 合并失败: ${JSON.stringify(personMerge.data)}`);
    const adminByOldPerson = await adminClient.get(`/api/admin/people/${state.duplicatePersonId}`);
    assert.equal(adminByOldPerson.status, 200, "Person 旧 id 必须仍可解析");
    assert.equal((adminByOldPerson.data as { person?: { displayName?: string } }).person?.displayName, `Governance Person ${suffix}`);
  });

  test("治理审计：grant/revoke/claim/merge 均落库", async (t) => {
    skipUnlessReady(t);
    const client = await db();
    const audits = await client.coreAuditLog.findMany({
      where: {
        createdAt: { gte: runStartedAt },
        action: { in: ["institution_representation.grant", "institution_representation.revoke", "person.claim", "person.merge", "institution.merge"] },
      },
    });
    const actions = new Set(audits.map((audit) => audit.action));
    for (const action of ["institution_representation.grant", "institution_representation.revoke", "person.claim", "person.merge", "institution.merge"]) {
      assert.equal(actions.has(action), true, `缺少审计动作 ${action}`);
    }
  });
});
