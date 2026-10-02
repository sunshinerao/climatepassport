/**
 * API 集成测试：受控资产上传/finalize、扫描门禁、不可变证据版本与
 * 衍生文件权限继承（CP-TODO-248 / CP-FR-058）
 *
 * 覆盖矩阵（真实数据库 + CONTROLLED_ASSET_STORAGE=local 本地存储）：
 * - 登记：POST /api/assets 合法声明 201（assetId + 内容寻址 storageKey
 *   "assets/<ownerId>/<sha256>"）；声明 application/x-msdownload → 400
 *   ASSET_CONTENT_TYPE_MISMATCH；sha256 非 64 位小写 hex → 400；匿名 401
 * - 上传：PUT /api/assets/[id]/content（原生 fetch 传 Buffer 字节，
 *   ApiClient 仅支持 JSON）——长度不符 → 400 ASSET_INTEGRITY_MISMATCH；
 *   声明 image/png 上传 MZ 头可执行字节（magic bytes 嗅探）→ 400
 *   ASSET_CONTENT_TYPE_MISMATCH；正确 PNG 字节 → 200
 *   {locationMetadataStripped:false}；非所有者上传 → 403 ASSET_ACCESS_DENIED
 * - 扫描门禁：上传后未 finalize 时 owner 下载 → 409 ASSET_SCAN_PENDING；
 *   finalize 200 {status:"READY",scanStatus:"CLEAN"}；二次 finalize 幂等
 * - 下载：finalize 后 owner GET 200，x-content-sha256 与字节 sha256 一致、
 *   content-type=image/png、cache-control 含 no-store；grantee 403；
 *   元数据 GET /api/assets/[id] 200；匿名 401
 * - EXIF 剥离：拼接的最小 JPEG（FFD8 + FFE1 "Exif\0\0" 段 + FFD9）声明
 *   image/jpeg 上传 → 200 locationMetadataStripped=true，落盘字节不再含 Exif
 * - 证据版本与衍生：POST /api/records 建记录；evidence 绑定资产 201；
 *   衍生版本（assetId=第二条 + derivedFromAssetId=第一条）201；
 *   对记录授 grantee READ 后 grantee 下载衍生资产 200（记录读权）、
 *   下载原始资产 200（衍生链继承 + 直接绑定）；outsider 两个都 403
 * - 检疫：POST /api/admin/assets/[id]/quarantine —— 非 admin 403 JSON
 *   （后台接口鉴权迁移第 1 批）；
 *   admin 200；此后任何账号（owner/grantee）下载该资产 → 409
 *   ASSET_SCAN_FAILED
 * - 审计：asset.register/asset.upload/asset.finalize/asset.quarantine/
 *   evidence.create 均落 core_audit_logs
 *
 * 运行方式：npm run test:api（隔离测试数据库 + 本地测试服务器）。
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { before, describe, test } from "node:test";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { ApiClient, waitForServer } from "./_client";
import { buildLoginPayload, testData } from "../fixtures/test-data";

const baseURL = process.env.CP_TEST_BASE_URL || "http://localhost:3100";
const locale = testData.locale;
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const runStartedAt = new Date();

// 1x1 PNG 参考字节（无 eXIf chunk，不应触发剥离）。
const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const pngSha256 = sha256Hex(pngBytes);

// 声明 image/png 的 MZ 头可执行字节（magic-bytes 嗅探应为 octet-stream）。
const mzBytes = Buffer.concat([
  Buffer.from("MZ", "ascii"),
  Buffer.from([0x90, 0x00, 0x03, 0x00, 0x00, 0x00]),
  Buffer.alloc(64, 0xcc),
]);

// 拼接的最小 JPEG：SOI + APP1(Exif) 段 + EOI，用于定位元数据剥离断言。
const exifPayload = Buffer.concat([
  Buffer.from("Exif\0\0", "binary"),
  Buffer.from(`GPS ${suffix} 31.2304,121.4737`, "utf8"),
]);
const jpegBytes = Buffer.concat([
  Buffer.from([0xff, 0xd8]),
  Buffer.from([0xff, 0xe1, (exifPayload.length + 2) >> 8, (exifPayload.length + 2) & 0xff]),
  exifPayload,
  Buffer.from([0xff, 0xd9]),
]);
const jpegSha256 = sha256Hex(jpegBytes);

let serverReady = false;
let prisma: PrismaClient | null = null;

const adminClient = new ApiClient(baseURL);
const ownerClient = new ApiClient(baseURL);
const granteeClient = new ApiClient(baseURL);
const outsiderClient = new ApiClient(baseURL);
const anonymousClient = new ApiClient(baseURL);

const state: {
  ownerUserId?: string;
  granteeUserId?: string;
  outsiderUserId?: string;
  assetId?: string;
  execAssetId?: string;
  jpegAssetId?: string;
  jpegStoredSha256?: string;
  asset2Id?: string;
  asset2Sha256?: string;
  recordId?: string;
} = {};

function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

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
    t.skip("账号未验证邮箱，跳过受控资产测试");
    return false;
  }
  assert.equal(response.status, 200, `登录失败 (${email}): ${JSON.stringify(response.data)}`);
  return true;
}

async function readJsonSafe(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

/** 原生 fetch 上传字节：ApiClient 仅支持 JSON，字节流需自行携带会话 Cookie。 */
async function putAssetBytes(client: ApiClient, assetId: string, bytes: Buffer) {
  const response = await fetch(`${baseURL}/api/assets/${assetId}/content`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/octet-stream",
      Cookie: client.getCookieString(),
    },
    body: bytes,
  });
  return { status: response.status, headers: response.headers, data: await readJsonSafe(response) };
}

/** 原生 fetch 下载字节；错误响应体按 JSON 解析便于断言 code。 */
async function getAssetContent(client: ApiClient, assetId: string) {
  const response = await fetch(`${baseURL}/api/assets/${assetId}/content`, {
    method: "GET",
    headers: { Cookie: client.getCookieString() },
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? (JSON.parse(buffer.toString("utf8")) as Record<string, unknown>)
    : null;
  return { status: response.status, headers: response.headers, buffer, data };
}

/** 登记资产的便捷封装（owner 身份）。 */
async function registerPngAsset(client: ApiClient, fileName: string, bytes: Buffer, contentType = "image/png") {
  return client.post("/api/assets", {
    fileName,
    contentType,
    byteSize: bytes.length,
    sha256: sha256Hex(bytes),
    purpose: "evidence",
  });
}

before(async () => {
  serverReady = await waitForServer(baseURL, 30000);
});

describe("受控资产与证据版本（CP-TODO-248）", () => {
  test("准备：admin 登录，owner/grantee/outsider 账号建立并登录", async (t) => {
    skipUnlessReady(t);
    const seeded = testData.seededUsers;
    assert.ok(await login(adminClient, seeded.admin.email, t));

    const client = await db();
    const passwordHash = await hash("seeded-password", 10);
    const [owner, grantee, outsider] = await Promise.all([
      createUser(client, `asset_owner_${suffix}@example.com`, "Asset Owner", passwordHash),
      createUser(client, `asset_grantee_${suffix}@example.com`, "Asset Grantee", passwordHash),
      createUser(client, `asset_outsider_${suffix}@example.com`, "Asset Outsider", passwordHash),
    ]);
    state.ownerUserId = owner.id;
    state.granteeUserId = grantee.id;
    state.outsiderUserId = outsider.id;
    assert.ok(await login(ownerClient, `asset_owner_${suffix}@example.com`, t));
    assert.ok(await login(granteeClient, `asset_grantee_${suffix}@example.com`, t));
    assert.ok(await login(outsiderClient, `asset_outsider_${suffix}@example.com`, t));
  });

  test("登记：合法声明 201 且存储键内容寻址；非法类型/sha256 400；匿名 401", async (t) => {
    skipUnlessReady(t);

    const anonymous = await anonymousClient.post("/api/assets", {
      fileName: `evidence-${suffix}.png`,
      contentType: "image/png",
      byteSize: pngBytes.length,
      sha256: pngSha256,
      purpose: "evidence",
    });
    assert.equal(anonymous.status, 401, "匿名登记必须 401");

    const register = await registerPngAsset(ownerClient, `evidence-${suffix}.png`, pngBytes);
    assert.equal(register.status, 201, `登记失败: ${JSON.stringify(register.data)}`);
    const body = register.data as { assetId: string; storageKey: string };
    state.assetId = body.assetId;
    assert.ok(body.assetId, "应返回 assetId");
    assert.equal(
      body.storageKey,
      `assets/${state.ownerUserId}/${pngSha256}`,
      "storageKey 必须为内容寻址 assets/<ownerId>/<sha256>",
    );

    const badType = await ownerClient.post("/api/assets", {
      fileName: `payload-${suffix}.exe`,
      contentType: "application/x-msdownload",
      byteSize: mzBytes.length,
      sha256: sha256Hex(mzBytes),
      purpose: "evidence",
    });
    assert.equal(badType.status, 400, "不允许的 contentType 必须 400");
    assert.equal((badType.data as { code: string }).code, "ASSET_CONTENT_TYPE_MISMATCH");

    const badSha = await ownerClient.post("/api/assets", {
      fileName: `evidence-${suffix}.png`,
      contentType: "image/png",
      byteSize: pngBytes.length,
      sha256: "not-a-64-hex-digest",
      purpose: "evidence",
    });
    assert.equal(badSha.status, 400, "非 64 位小写 hex 的 sha256 必须 400");
  });

  test("上传：完整性/真实类型校验与所有权矩阵", async (t) => {
    skipUnlessReady(t);

    // 完整性：上传字节长度与登记声明不符 → 400（状态仍为 UPLOADED，后续可重传）。
    const execRegister = await ownerClient.post("/api/assets", {
      fileName: `screenshot-${suffix}.png`,
      contentType: "image/png",
      byteSize: mzBytes.length,
      sha256: sha256Hex(mzBytes),
      purpose: "evidence",
    });
    assert.equal(execRegister.status, 201, `登记嗅探矩阵资产失败: ${JSON.stringify(execRegister.data)}`);
    state.execAssetId = (execRegister.data as { assetId: string }).assetId;

    const wrongLength = await putAssetBytes(ownerClient, state.assetId!, Buffer.concat([pngBytes, Buffer.from([0x00])]));
    assert.equal(wrongLength.status, 400, "长度不符的字节必须 400");
    assert.equal((wrongLength.data as { code: string }).code, "ASSET_INTEGRITY_MISMATCH");

    // 真实类型：声明 image/png 上传 MZ 头可执行字节 → magic-bytes 嗅探拒绝。
    const wrongType = await putAssetBytes(ownerClient, state.execAssetId, mzBytes);
    assert.equal(wrongType.status, 400, "嗅探类型与声明不符必须 400");
    assert.equal((wrongType.data as { code: string }).code, "ASSET_CONTENT_TYPE_MISMATCH");

    // 所有权：非所有者不得上传。
    const notOwner = await putAssetBytes(granteeClient, state.assetId!, pngBytes);
    assert.equal(notOwner.status, 403);
    assert.equal((notOwner.data as { code: string }).code, "ASSET_ACCESS_DENIED");

    // 正确字节：200 且不触发定位元数据剥离。
    const upload = await putAssetBytes(ownerClient, state.assetId!, pngBytes);
    assert.equal(upload.status, 200, `上传失败: ${JSON.stringify(upload.data)}`);
    const uploaded = upload.data as { assetId: string; byteSize: number; sha256: string; locationMetadataStripped: boolean };
    assert.equal(uploaded.assetId, state.assetId);
    assert.equal(uploaded.locationMetadataStripped, false, "无 eXIf 的 PNG 不应标记剥离");
    assert.equal(uploaded.sha256, pngSha256);
    assert.equal(uploaded.byteSize, pngBytes.length);
  });

  test("扫描门禁：finalize 前 owner 下载 409；finalize 200 READY/CLEAN 且幂等", async (t) => {
    skipUnlessReady(t);

    const pending = await getAssetContent(ownerClient, state.assetId!);
    assert.equal(pending.status, 409, "扫描未完成时不得使用/下载资产");
    assert.equal((pending.data as { code: string }).code, "ASSET_SCAN_PENDING");

    const finalize = await ownerClient.post(`/api/assets/${state.assetId}/finalize`, {});
    assert.equal(finalize.status, 200, `finalize 失败: ${JSON.stringify(finalize.data)}`);
    const finalized = finalize.data as { assetId: string; status: string; scanStatus: string };
    assert.equal(finalized.status, "READY");
    assert.equal(finalized.scanStatus, "CLEAN");

    const again = await ownerClient.post(`/api/assets/${state.assetId}/finalize`, {});
    assert.equal(again.status, 200, "二次 finalize 应幂等返回当前状态");
    const repeated = again.data as { assetId: string; status: string; scanStatus: string };
    assert.equal(repeated.assetId, state.assetId);
    assert.equal(repeated.status, "READY");
    assert.equal(repeated.scanStatus, "CLEAN");
  });

  test("下载与元数据：owner 200 且响应头/字节摘要一致；grantee 403；匿名 401", async (t) => {
    skipUnlessReady(t);

    const download = await getAssetContent(ownerClient, state.assetId!);
    assert.equal(download.status, 200, `owner 下载失败: ${JSON.stringify(download.data)}`);
    assert.equal(download.headers.get("content-type"), "image/png");
    assert.match(download.headers.get("cache-control") || "", /no-store/, "下载响应必须禁缓存");
    const digestHeader = download.headers.get("x-content-sha256");
    assert.ok(digestHeader, "应返回 x-content-sha256 摘要头");
    assert.equal(sha256Hex(download.buffer), digestHeader, "字节 sha256 必须与响应头一致");
    assert.equal(digestHeader, pngSha256);

    const grantee = await getAssetContent(granteeClient, state.assetId!);
    assert.equal(grantee.status, 403, "未授权用户下载必须 403");
    assert.equal((grantee.data as { code: string }).code, "ASSET_ACCESS_DENIED");

    const metadata = await ownerClient.get(`/api/assets/${state.assetId}`);
    assert.equal(metadata.status, 200, `读取元数据失败: ${JSON.stringify(metadata.data)}`);
    const asset = (metadata.data as { asset: Record<string, unknown> }).asset;
    assert.equal(asset.id, state.assetId);
    assert.equal(asset.contentType, "image/png");
    assert.equal(asset.sha256, pngSha256);
    assert.equal(asset.ownerUserId, state.ownerUserId);

    const anonymous = await anonymousClient.get(`/api/assets/${state.assetId}`);
    assert.equal(anonymous.status, 401, "匿名读取元数据必须 401");
  });

  test("EXIF 剥离：最小 JPEG 声明 image/jpeg 上传 locationMetadataStripped=true", async (t) => {
    skipUnlessReady(t);

    const register = await ownerClient.post("/api/assets", {
      fileName: `photo-${suffix}.jpg`,
      contentType: "image/jpeg",
      byteSize: jpegBytes.length,
      sha256: jpegSha256,
      purpose: "evidence",
    });
    assert.equal(register.status, 201, `登记 JPEG 失败: ${JSON.stringify(register.data)}`);
    state.jpegAssetId = (register.data as { assetId: string }).assetId;

    const upload = await putAssetBytes(ownerClient, state.jpegAssetId, jpegBytes);
    assert.equal(upload.status, 200, `上传 JPEG 失败: ${JSON.stringify(upload.data)}`);
    const uploaded = upload.data as { locationMetadataStripped: boolean; sha256: string; byteSize: number };
    assert.equal(uploaded.locationMetadataStripped, true, "含 Exif APP1 段的 JPEG 必须剥离定位元数据");
    assert.notEqual(uploaded.sha256, jpegSha256, "剥离后存储摘要须按新字节重算");
    assert.ok(uploaded.byteSize < jpegBytes.length, "剥离后字节数应缩小");
    state.jpegStoredSha256 = uploaded.sha256;

    const finalize = await ownerClient.post(`/api/assets/${state.jpegAssetId}/finalize`, {});
    assert.equal(finalize.status, 200);
    assert.equal((finalize.data as { status: string }).status, "READY");

    const download = await getAssetContent(ownerClient, state.jpegAssetId);
    assert.equal(download.status, 200);
    assert.equal(
      download.buffer.includes(Buffer.from("Exif", "ascii")),
      false,
      "落盘字节不得再包含 Exif 段",
    );
    assert.equal(sha256Hex(download.buffer), state.jpegStoredSha256);
  });

  test("证据版本与衍生：evidence 201；授权后 grantee 经记录读权/衍生链下载 200；outsider 403", async (t) => {
    skipUnlessReady(t);

    const record = await ownerClient.post("/api/records", {
      recordType: "evidence_log",
      title: `Asset Evidence ${suffix}`,
      payloadJson: { source: "cp-todo-248", note: "controlled asset evidence" },
    });
    assert.equal(record.status, 201, `创建记录失败: ${JSON.stringify(record.data)}`);
    state.recordId = (record.data as { recordId: string }).recordId;
    assert.equal((record.data as { revision: number }).revision, 1);

    // 第二条 PNG 资产（衍生版本的载体）：登记/上传/finalize。
    // 字节必须与第一条不同（storageKey 内容寻址唯一，同所有者同哈希会唯一冲突）。
    const pngBytes2 = Buffer.concat([pngBytes, Buffer.from(`-derived-${suffix}`)]);
    const register2 = await registerPngAsset(ownerClient, `derived-${suffix}.png`, pngBytes2);
    assert.equal(register2.status, 201, `登记第二条资产失败: ${JSON.stringify(register2.data)}`);
    state.asset2Id = (register2.data as { assetId: string }).assetId;
    const upload2 = await putAssetBytes(ownerClient, state.asset2Id, pngBytes2);
    assert.equal(upload2.status, 200, `上传第二条资产失败: ${JSON.stringify(upload2.data)}`);
    state.asset2Sha256 = (upload2.data as { sha256: string }).sha256;
    const finalize2 = await ownerClient.post(`/api/assets/${state.asset2Id}/finalize`, {});
    assert.equal(finalize2.status, 200);
    assert.equal((finalize2.data as { status: string }).status, "READY");

    // 证据 v1：记录直接绑定第一条资产。
    const evidence1 = await ownerClient.post(`/api/records/${state.recordId}/evidence`, {
      assetId: state.assetId,
      title: `原始证据 ${suffix}`,
      snapshotJson: { capture: "origin" },
    });
    assert.equal(evidence1.status, 201, `创建证据版本失败: ${JSON.stringify(evidence1.data)}`);
    assert.equal((evidence1.data as { version: number }).version, 1);

    // 证据 v2：衍生文件（assetId=第二条，derivedFromAssetId=第一条）。
    const evidence2 = await ownerClient.post(`/api/records/${state.recordId}/evidence`, {
      assetId: state.asset2Id,
      derivedFromAssetId: state.assetId,
      title: `衍生剪辑 ${suffix}`,
      snapshotJson: { capture: "derived" },
    });
    assert.equal(evidence2.status, 201, `创建衍生版本失败: ${JSON.stringify(evidence2.data)}`);
    assert.equal((evidence2.data as { version: number }).version, 2);

    // 授权前：outsider 对两条资产均 403。
    const outsiderOriginal = await getAssetContent(outsiderClient, state.assetId!);
    assert.equal(outsiderOriginal.status, 403, "outsider 下载原始资产必须 403");
    assert.equal((outsiderOriginal.data as { code: string }).code, "ASSET_ACCESS_DENIED");
    const outsiderDerived = await getAssetContent(outsiderClient, state.asset2Id);
    assert.equal(outsiderDerived.status, 403, "outsider 下载衍生资产必须 403");
    assert.equal((outsiderDerived.data as { code: string }).code, "ASSET_ACCESS_DENIED");

    // 记录所有者授 grantee READ（对象级授权）。
    const grant = await ownerClient.post(`/api/records/${state.recordId}/grants`, {
      subjectUserId: state.granteeUserId,
      action: "READ",
      purpose: "evidence review",
    });
    assert.equal(grant.status, 201, `记录授权失败: ${JSON.stringify(grant.data)}`);
    assert.ok((grant.data as { grantId: string }).grantId, "应返回 grantId");

    // grantee 经记录读权下载衍生资产 200。
    const granteeDerived = await getAssetContent(granteeClient, state.asset2Id);
    assert.equal(granteeDerived.status, 200, `grantee 下载衍生资产失败: ${JSON.stringify(granteeDerived.data)}`);
    assert.equal(sha256Hex(granteeDerived.buffer), state.asset2Sha256);

    // grantee 下载原始资产 200（衍生链继承 + 记录直接绑定）。
    const granteeOriginal = await getAssetContent(granteeClient, state.assetId!);
    assert.equal(granteeOriginal.status, 200, `grantee 下载原始资产失败: ${JSON.stringify(granteeOriginal.data)}`);
    assert.equal(sha256Hex(granteeOriginal.buffer), pngSha256);
  });

  test("检疫：非 admin 403；admin 200；此后下载一律 409 ASSET_SCAN_FAILED", async (t) => {
    skipUnlessReady(t);

    // 后台写路由已改用 requireApiRole：非 ADMIN 直接 403 JSON，不再走页面式 redirect()。
    const ownerAttempt = await fetch(`${baseURL}/api/admin/assets/${state.assetId}/quarantine`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/json",
        Cookie: ownerClient.getCookieString(),
      },
      body: JSON.stringify({ reason: "non-admin attempt" }),
    });
    assert.equal(ownerAttempt.status, 403, `非 admin 检疫必须 403，实际 ${ownerAttempt.status}`);
    assert.ok(ownerAttempt.headers.get("content-type")?.includes("application/json"), "鉴权失败必须返回 JSON");
    assert.equal((await ownerAttempt.json()).error, "Forbidden.");

    const quarantine = await adminClient.post(`/api/admin/assets/${state.assetId}/quarantine`, {
      reason: `malware detected in evidence ${suffix}`,
    });
    assert.equal(quarantine.status, 200, `admin 检疫失败: ${JSON.stringify(quarantine.data)}`);
    assert.equal((quarantine.data as { assetId: string }).assetId, state.assetId);

    const client = await db();
    const row = await client.controlledAsset.findUniqueOrThrow({ where: { id: state.assetId! } });
    assert.equal(row.status, "QUARANTINED");
    assert.equal(row.scanStatus, "INFECTED");

    // 隔离后任何账号下载均 409（owner 与经授权 grantee 都不例外）。
    const ownerDownload = await getAssetContent(ownerClient, state.assetId!);
    assert.equal(ownerDownload.status, 409);
    assert.equal((ownerDownload.data as { code: string }).code, "ASSET_SCAN_FAILED");
    const granteeDownload = await getAssetContent(granteeClient, state.assetId!);
    assert.equal(granteeDownload.status, 409, "grantee 下载隔离资产必须 409");
    assert.equal((granteeDownload.data as { code: string }).code, "ASSET_SCAN_FAILED");
  });

  test("审计：register/upload/finalize/quarantine/evidence.create 均落库", async (t) => {
    skipUnlessReady(t);
    const client = await db();
    const audits = await client.coreAuditLog.findMany({
      where: {
        createdAt: { gte: runStartedAt },
        action: { in: ["asset.register", "asset.upload", "asset.finalize", "asset.quarantine", "evidence.create"] },
      },
    });
    const actions = new Set(audits.map((audit) => audit.action));
    for (const action of ["asset.register", "asset.upload", "asset.finalize", "asset.quarantine", "evidence.create"]) {
      assert.equal(actions.has(action), true, `缺少审计动作 ${action}`);
    }
    const quarantineAudit = audits.find((audit) => audit.action === "asset.quarantine");
    assert.ok(quarantineAudit, "应有 asset.quarantine 审计行");
  });
});
