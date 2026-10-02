/**
 * 源码级测试：受控上传资产 / finalize 扫描门禁 / 不可变证据版本 / 衍生链权限继承
 * （CP-TODO-248 / CP-FR-058，模式同 private-records.test.mjs：vm 沙箱 + 内存 Prisma mock）
 *
 * 覆盖：
 * - sniffContentType：png/jpeg/gif/webp/pdf/纯文本/可执行字节的 magic-bytes 判定
 * - stripLocationMetadata：JPEG 剥除 EXIF APP1 段且保留其它段；PNG 剥除 eXIf chunk
 *   且保留签名/IHDR/IEND；非图片类型原样返回
 * - registerControlledAsset：不允许的 contentType → 400 ASSET_CONTENT_TYPE_MISMATCH；
 *   非法 sha256 → 400 INVALID_REQUEST；成功创建且 storageKey = assets/<owner>/<sha256>
 * - uploadControlledAssetBytes：byteSize 不符 / sha256 不符 → 400 ASSET_INTEGRITY_MISMATCH；
 *   声明 png 实为可执行字节 → 400 ASSET_CONTENT_TYPE_MISMATCH；成功上传剥除定位元数据、
 *   行内 sha256 更新为存储字节哈希，getControlledAssetBytes 读回一致
 * - finalizeControlledAsset：注入扫描器 INFECTED → QUARANTINED、CLEAN → READY、
 *   二次调用幂等不重跑扫描器
 * - createEvidenceVersion：PENDING → ASSET_SCAN_PENDING、QUARANTINED → ASSET_SCAN_FAILED；
 *   衍生版本要求对原始资产的读权；无 recordId/assetId/derivedFromAssetId → 400；
 *   记录绑定需 WRITE 权限（只读授权 403）、撤回记录 409、不存在 404
 * - resolveAssetAccess：所有者读权、绑定记录授权读权、衍生链继承方向
 *
 * 存储语义：行内只存 storageKey；provider 由服务在调用时从
 * process.env.CONTROLLED_ASSET_STORAGE 推导（local 模式还需 CONTROLLED_ASSET_LOCAL_ROOT），
 * 因此每个触碰存储的测试开头都会设置这两个环境变量并指向 mkdtemp 临时目录。
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadService, matchesWhere } from "./_service-loader.mjs";

const assets = loadService("apps/passport-web/lib/server/controlled-assets.ts");
const storage = loadService("apps/passport-web/lib/server/controlled-asset-storage.ts");

const HEX64 = "ab".repeat(32);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/** 本地存储环境：storage 模块在调用时读 env，故在每个存储相关测试开头设置。 */
function useLocalStorage() {
  process.env.CONTROLLED_ASSET_STORAGE = "local";
  process.env.CONTROLLED_ASSET_LOCAL_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "cp-assets-"));
}

/** 构造最小 PNG：合法 8 字节签名 + IHDR + 可选 eXIf + IEND（CRC 为假值，剥除逻辑不校验）。 */
function pngBytes({ withExif = false } = {}) {
  const chunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, "ascii");
    return Buffer.concat([head, data, Buffer.alloc(4)]);
  };
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = chunk("IHDR", Buffer.alloc(13, 1));
  const iend = chunk("IEND", Buffer.alloc(0));
  const exif = chunk("eXIf", Buffer.from([0xaa, 0xbb, 0xcc, 0xdd]));
  return Buffer.concat(withExif ? [signature, ihdr, exif, iend] : [signature, ihdr, iend]);
}

/** 构造最小 JPEG：SOI + APP0(JFIF) + 可选 APP1(Exif) + EOI。 */
function jpegBytes({ withExif = false } = {}) {
  const soi = Buffer.from([0xff, 0xd8]);
  const app0 = Buffer.concat([Buffer.from([0xff, 0xe0, 0x00, 0x06]), Buffer.from("JFIF", "ascii")]);
  const eoi = Buffer.from([0xff, 0xd9]);
  const segments = [soi, app0];
  if (withExif) {
    const payload = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), Buffer.from([0x00, 0x2a, 0x00, 0x00])]);
    segments.push(Buffer.concat([Buffer.from([0xff, 0xe1, 0x00, 2 + payload.length]), payload]));
  }
  segments.push(eoi);
  return Buffer.concat(segments);
}

function makeFake({ assets: seededAssets = [], evidence = [], records = [], grants = [], memberships = [], programmes = [] } = {}) {
  const state = {
    controlledAssets: seededAssets.map((asset) => ({
      fileName: "seed.png",
      contentType: "image/png",
      byteSize: 1,
      sha256: HEX64,
      storageKey: `assets/${asset.ownerUserId ?? "owner-1"}/${HEX64}`,
      purpose: "evidence",
      scanStatus: "PENDING",
      status: "UPLOADED",
      scanCheckedAt: null,
      ...asset,
    })),
    evidenceVersions: evidence.map((row) => ({ recordId: null, assetId: null, derivedFromAssetId: null, version: 1, createdById: null, ...row })),
    scopedRecords: records.map((record) => ({ status: "ACTIVE", currentRevision: 1, programmeId: null, payloadJson: {}, createdById: null, ...record })),
    revisions: [],
    grants: grants.map((grant) => ({ programmeId: null, editionId: null, purpose: null, isActive: true, revokedAt: null, validFrom: null, validUntil: null, ...grant })),
    memberships: memberships.map((membership) => ({ editionId: null, isActive: true, revokedAt: null, validFrom: null, validUntil: null, ...membership })),
    programmes: programmes.map((programme) => ({ isActive: true, ...programme })),
    users: [{ id: "owner-1" }, { id: "owner-2" }, { id: "reader-1" }, { id: "outsider-1" }],
    audits: [],
  };

  const fake = {
    controlledAsset: {
      create: async ({ data }) => {
        const row = { id: `asset-${state.controlledAssets.length + 1}`, scanCheckedAt: null, createdAt: new Date(), updatedAt: new Date(), ...data };
        state.controlledAssets.push(row);
        return row;
      },
      findUnique: async ({ where }) => state.controlledAssets.find((row) => row.id === where.id) ?? null,
      findMany: async ({ where } = {}) => state.controlledAssets.filter((row) => matchesWhere(row, where)),
      update: async ({ where, data }) => {
        const row = state.controlledAssets.find((r) => r.id === where.id);
        if (!row) throw new Error("controlled asset not found");
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
      updateMany: async ({ where, data }) => {
        const targets = state.controlledAssets.filter((row) => matchesWhere(row, where));
        for (const row of targets) Object.assign(row, data, { updatedAt: new Date() });
        return { count: targets.length };
      },
    },
    evidenceVersion: {
      create: async ({ data }) => {
        const row = { id: `ev-${state.evidenceVersions.length + 1}`, recordId: null, assetId: null, derivedFromAssetId: null, createdById: null, createdAt: new Date(), ...data };
        state.evidenceVersions.push(row);
        return row;
      },
      findMany: async ({ where } = {}) => state.evidenceVersions.filter((row) => matchesWhere(row, where)),
      findFirst: async ({ where, orderBy } = {}) => {
        let rows = state.evidenceVersions.filter((row) => matchesWhere(row, where));
        if (orderBy) {
          const [field, dir] = Object.entries(orderBy)[0];
          rows = [...rows].sort((a, b) => (dir === "desc" ? b[field] - a[field] : a[field] - b[field]));
        }
        return rows[0] ?? null;
      },
    },
    scopedRecord: {
      create: async ({ data }) => {
        const row = { id: `rec-${state.scopedRecords.length + 1}`, status: "ACTIVE", currentRevision: 1, programmeId: null, createdById: null, createdAt: new Date(), updatedAt: new Date(), ...data };
        state.scopedRecords.push(row);
        return row;
      },
      findUnique: async ({ where }) => state.scopedRecords.find((row) => row.id === where.id) ?? null,
      findMany: async ({ where } = {}) => state.scopedRecords.filter((row) => matchesWhere(row, where)),
      update: async ({ where, data }) => {
        const row = state.scopedRecords.find((r) => r.id === where.id);
        if (!row) throw new Error("scoped record not found");
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
      updateMany: async ({ where, data }) => {
        const targets = state.scopedRecords.filter((row) => matchesWhere(row, where));
        for (const row of targets) Object.assign(row, data, { updatedAt: new Date() });
        return { count: targets.length };
      },
    },
    recordRevision: {
      create: async ({ data }) => {
        const row = { id: `rev-${state.revisions.length + 1}`, createdById: null, createdAt: new Date(), ...data };
        state.revisions.push(row);
        return row;
      },
      findMany: async ({ where } = {}) => state.revisions.filter((row) => matchesWhere(row, where)),
    },
    objectAuthorization: {
      create: async ({ data }) => {
        const row = { id: `grant-${state.grants.length + 1}`, editionId: null, purpose: null, isActive: true, revokedAt: null, validFrom: null, validUntil: null, ...data };
        state.grants.push(row);
        return row;
      },
      findFirst: async ({ where } = {}) => state.grants.find((row) => matchesWhere(row, where)) ?? null,
      findMany: async ({ where } = {}) => state.grants.filter((row) => matchesWhere(row, where)),
      findUnique: async ({ where }) => state.grants.find((row) => row.id === where.id) ?? null,
      updateMany: async ({ where, data }) => {
        const targets = state.grants.filter((row) => matchesWhere(row, where));
        for (const row of targets) Object.assign(row, data);
        return { count: targets.length };
      },
    },
    accessMembership: {
      findMany: async ({ where } = {}) => state.memberships.filter((row) => matchesWhere(row, where)),
    },
    programme: {
      findFirst: async ({ where } = {}) => state.programmes.find((row) => matchesWhere(row, where)) ?? null,
    },
    edition: { findFirst: async () => null },
    institutionRepresentation: { findFirst: async () => null },
    sourceObjectMapping: { findFirst: async () => null },
    user: { findUnique: async ({ where }) => state.users.find((row) => row.id === where.id) ?? null },
    coreAuditLog: { create: async ({ data }) => { state.audits.push(data); return data; } },
    $transaction: async (callback) => callback(fake),
  };
  return { fake, state };
}

/** 便捷流程：登记 + 上传 + finalize（CLEAN）→ READY 资产。 */
async function readyAsset(fake, { ownerUserId = "owner-1", bytes = pngBytes(), contentType = "image/png" } = {}) {
  const declared = sha256(bytes);
  const registered = await assets.registerControlledAsset(fake, { actorUserId: ownerUserId, fileName: "a.png", contentType, byteSize: bytes.length, sha256: declared });
  const uploaded = await assets.uploadControlledAssetBytes(fake, { assetId: registered.assetId, actorUserId: ownerUserId, bytes });
  const finalized = await assets.finalizeControlledAsset(fake, { assetId: registered.assetId, actorUserId: ownerUserId, scanner: async () => "CLEAN" });
  return { registered, uploaded, finalized };
}

test("sniffContentType：png/jpeg/gif/webp/pdf/纯文本/可执行字节判定", () => {
  assert.equal(assets.sniffContentType(pngBytes()), "image/png");
  assert.equal(assets.sniffContentType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00])), "image/jpeg");
  assert.equal(assets.sniffContentType(Buffer.from("GIF89a", "ascii")), "image/gif");
  assert.equal(assets.sniffContentType(Buffer.concat([Buffer.from("RIFF", "ascii"), Buffer.alloc(4), Buffer.from("WEBP", "ascii")])), "image/webp");
  assert.equal(assets.sniffContentType(Buffer.from("%PDF-1.7\n", "ascii")), "application/pdf");
  assert.equal(assets.sniffContentType(Buffer.from("hello climate passport", "utf8")), "text/plain");
  // 含 NUL 的可执行字节不可判为文本 → octet-stream
  assert.equal(assets.sniffContentType(Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x00, 0x01, 0x00])), "application/octet-stream");
  // ≥1024 字节一律 octet-stream（文本判定仅用于小探测）
  assert.equal(assets.sniffContentType(Buffer.alloc(1500, 0x61)), "application/octet-stream");
});

test("stripLocationMetadata：JPEG 剥除 EXIF APP1 段且保留其它段", () => {
  const bytes = jpegBytes({ withExif: true });
  const { bytes: stripped, stripped: didStrip } = assets.stripLocationMetadata(bytes, "image/jpeg");
  assert.equal(didStrip, true);
  // 结果 = SOI + APP0(JFIF) + EOI，EXIF APP1 段被整体剥除
  const soi = bytes.subarray(0, 2);
  const app0 = bytes.subarray(2, 10);
  const eoi = bytes.subarray(bytes.length - 2);
  assert.ok(stripped.equals(Buffer.concat([soi, app0, eoi])));
  assert.equal(stripped.includes(Buffer.from("Exif", "latin1")), false);
  assert.equal(stripped.includes(Buffer.from("JFIF", "ascii")), true);
});

test("stripLocationMetadata：PNG 剥除 eXIf chunk 且保留签名/IHDR/IEND；非图片原样返回", () => {
  const bytes = pngBytes({ withExif: true });
  const { bytes: stripped, stripped: didStrip } = assets.stripLocationMetadata(bytes, "image/png");
  assert.equal(didStrip, true);
  const signature = bytes.subarray(0, 8);
  const ihdr = bytes.subarray(8, 8 + 25);
  const iend = bytes.subarray(bytes.length - 12);
  assert.ok(stripped.equals(Buffer.concat([signature, ihdr, iend])));
  assert.equal(stripped.includes(Buffer.from("eXIf", "ascii")), false);

  const noExif = pngBytes();
  const untouched = assets.stripLocationMetadata(noExif, "image/png");
  assert.equal(untouched.stripped, false);
  assert.ok(untouched.bytes.equals(noExif));

  const pdf = Buffer.from("%PDF-1.7\n", "ascii");
  const passthrough = assets.stripLocationMetadata(pdf, "application/pdf");
  assert.equal(passthrough.stripped, false);
  assert.ok(passthrough.bytes.equals(pdf));
});

test("registerControlledAsset：不允许的 contentType 与非法 sha256 均 400", async () => {
  const { fake } = makeFake();
  const badType = await assets.registerControlledAsset(fake, { actorUserId: "owner-1", fileName: "x.bin", contentType: "application/octet-stream", byteSize: 4, sha256: HEX64 });
  assert.equal(badType.status, 400);
  assert.equal(badType.code, "ASSET_CONTENT_TYPE_MISMATCH");

  const badSha = await assets.registerControlledAsset(fake, { actorUserId: "owner-1", fileName: "x.png", contentType: "image/png", byteSize: 4, sha256: "deadbeef" });
  assert.equal(badSha.status, 400);
  assert.equal(badSha.code, "INVALID_REQUEST");

  const upperSha = await assets.registerControlledAsset(fake, { actorUserId: "owner-1", fileName: "x.png", contentType: "image/png", byteSize: 4, sha256: "AB".repeat(32) });
  assert.equal(upperSha.status, 400, "sha256 必须为小写 hex");
  assert.equal(upperSha.code, "INVALID_REQUEST");

  const empty = await assets.registerControlledAsset(fake, { actorUserId: "owner-1", fileName: "x.png", contentType: "image/png", byteSize: 0, sha256: HEX64 });
  assert.equal(empty.code, "INVALID_REQUEST");
});

test("registerControlledAsset：成功创建且 storageKey 为 assets/<owner>/<sha256>", async () => {
  const { fake, state } = makeFake();
  const ok = await assets.registerControlledAsset(fake, { actorUserId: "owner-1", fileName: "photo.png", contentType: "image/png", byteSize: 123, sha256: HEX64 });
  assert.equal(ok.storageKey, `assets/owner-1/${HEX64}`);
  const row = state.controlledAssets[0];
  assert.equal(row.ownerUserId, "owner-1");
  assert.equal(row.scanStatus, "PENDING");
  assert.equal(row.status, "UPLOADED");
  assert.equal(row.purpose, "evidence");
  assert.equal(state.audits.filter((a) => a.action === "asset.register" && a.subjectId === row.id).length, 1);

  // contentType 带 charset 参数时归一化后仍允许
  const normalized = await assets.registerControlledAsset(fake, { actorUserId: "owner-1", fileName: "note.txt", contentType: "text/plain; charset=utf-8", byteSize: 5, sha256: "cd".repeat(32) });
  assert.equal(normalized.storageKey, `assets/owner-1/${"cd".repeat(32)}`);
});

test("uploadControlledAssetBytes：byteSize 不符 → 400 ASSET_INTEGRITY_MISMATCH", async () => {
  const { fake } = makeFake();
  const bytes = pngBytes();
  const registered = await assets.registerControlledAsset(fake, { actorUserId: "owner-1", fileName: "a.png", contentType: "image/png", byteSize: bytes.length + 1, sha256: sha256(bytes) });
  const result = await assets.uploadControlledAssetBytes(fake, { assetId: registered.assetId, actorUserId: "owner-1", bytes });
  assert.equal(result.status, 400);
  assert.equal(result.code, "ASSET_INTEGRITY_MISMATCH");
});

test("uploadControlledAssetBytes：sha256 不符 → 400 ASSET_INTEGRITY_MISMATCH", async () => {
  const { fake } = makeFake();
  const bytes = pngBytes();
  const tampered = Buffer.from(bytes);
  tampered[15] ^= 0xff;
  const registered = await assets.registerControlledAsset(fake, { actorUserId: "owner-1", fileName: "a.png", contentType: "image/png", byteSize: bytes.length, sha256: sha256(tampered) });
  const result = await assets.uploadControlledAssetBytes(fake, { assetId: registered.assetId, actorUserId: "owner-1", bytes });
  assert.equal(result.status, 400);
  assert.equal(result.code, "ASSET_INTEGRITY_MISMATCH");
});

test("uploadControlledAssetBytes：声明 png 实为可执行字节 → 400 ASSET_CONTENT_TYPE_MISMATCH", async () => {
  const { fake } = makeFake();
  const execBytes = Buffer.concat([Buffer.from("MZ", "ascii"), Buffer.from([0x90, 0x00, 0x03, 0x00, 0x00, 0x00])]);
  const registered = await assets.registerControlledAsset(fake, { actorUserId: "owner-1", fileName: "evil.png", contentType: "image/png", byteSize: execBytes.length, sha256: sha256(execBytes) });
  const result = await assets.uploadControlledAssetBytes(fake, { assetId: registered.assetId, actorUserId: "owner-1", bytes: execBytes });
  assert.equal(result.status, 400);
  assert.equal(result.code, "ASSET_CONTENT_TYPE_MISMATCH");
  assert.match(result.error, /application\/octet-stream/);
});

test("uploadControlledAssetBytes：非所有者 403，缺失资产 404", async () => {
  const { fake } = makeFake();
  const bytes = pngBytes();
  const registered = await assets.registerControlledAsset(fake, { actorUserId: "owner-1", fileName: "a.png", contentType: "image/png", byteSize: bytes.length, sha256: sha256(bytes) });
  const denied = await assets.uploadControlledAssetBytes(fake, { assetId: registered.assetId, actorUserId: "owner-2", bytes });
  assert.equal(denied.status, 403);
  assert.equal(denied.code, "ASSET_ACCESS_DENIED");
  const missing = await assets.uploadControlledAssetBytes(fake, { assetId: "asset-missing", actorUserId: "owner-1", bytes });
  assert.equal(missing.status, 404);
  assert.equal(missing.code, "ASSET_NOT_FOUND");
});

test("uploadControlledAssetBytes：成功上传剥除定位元数据，行内 sha256 更新为存储字节哈希且读回一致", async () => {
  process.env.CONTROLLED_ASSET_STORAGE = "local";
  process.env.CONTROLLED_ASSET_LOCAL_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "cp-assets-"));

  const { fake, state } = makeFake();
  const bytes = pngBytes({ withExif: true });
  const declaredSha = sha256(bytes);
  const registered = await assets.registerControlledAsset(fake, { actorUserId: "owner-1", fileName: "photo.png", contentType: "image/png", byteSize: bytes.length, sha256: declaredSha });

  const uploaded = await assets.uploadControlledAssetBytes(fake, { assetId: registered.assetId, actorUserId: "owner-1", bytes });
  assert.equal(uploaded.assetId, registered.assetId);
  assert.equal(uploaded.locationMetadataStripped, true);

  // 存储字节为剥除 eXIf 后的内容：行内 sha256/byteSize 被改写为存储摘要
  const stripped = assets.stripLocationMetadata(bytes, "image/png").bytes;
  assert.equal(uploaded.sha256, sha256(stripped));
  assert.notEqual(uploaded.sha256, declaredSha);
  assert.equal(uploaded.byteSize, stripped.length);
  const row = state.controlledAssets.find((r) => r.id === registered.assetId);
  assert.equal(row.sha256, uploaded.sha256);
  assert.equal(row.byteSize, stripped.length);
  assert.equal(row.status, "UPLOADED");
  assert.equal(state.audits.filter((a) => a.action === "asset.upload" && a.metadataJson.locationMetadataStripped === true).length, 1);

  // 读回校验：getControlledAssetBytes 以行内 storageKey + 存储 sha256 取回剥离后字节
  const readBack = await storage.getControlledAssetBytes({ provider: "local", key: row.storageKey, sha256: row.sha256 });
  assert.ok(readBack.equals(stripped));
});

test("finalizeControlledAsset：注入扫描器 INFECTED → QUARANTINED", async () => {
  process.env.CONTROLLED_ASSET_STORAGE = "local";
  process.env.CONTROLLED_ASSET_LOCAL_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "cp-assets-"));

  const { fake, state } = makeFake();
  const bytes = pngBytes();
  const registered = await assets.registerControlledAsset(fake, { actorUserId: "owner-1", fileName: "a.png", contentType: "image/png", byteSize: bytes.length, sha256: sha256(bytes) });
  await assets.uploadControlledAssetBytes(fake, { assetId: registered.assetId, actorUserId: "owner-1", bytes });

  let scanned = null;
  const result = await assets.finalizeControlledAsset(fake, {
    assetId: registered.assetId,
    actorUserId: "owner-1",
    scanner: async (scannedBytes, contentType) => {
      scanned = { bytes: scannedBytes, contentType };
      return "INFECTED";
    },
  });
  assert.equal(result.assetId, registered.assetId);
  assert.equal(result.status, "QUARANTINED");
  assert.equal(result.scanStatus, "INFECTED");
  assert.ok(scanned.bytes.equals(bytes), "扫描器收到的是存储回读字节");
  assert.equal(scanned.contentType, "image/png");
  const row = state.controlledAssets.find((r) => r.id === registered.assetId);
  assert.equal(row.status, "QUARANTINED");
  assert.equal(row.scanStatus, "INFECTED");
  assert.ok(row.scanCheckedAt instanceof Date);
  assert.equal(state.audits.filter((a) => a.action === "asset.quarantine" && a.result === "quarantined").length, 1);
});

test("finalizeControlledAsset：CLEAN → READY，二次调用幂等不重跑扫描器，READY 后重传 409", async () => {
  process.env.CONTROLLED_ASSET_STORAGE = "local";
  process.env.CONTROLLED_ASSET_LOCAL_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "cp-assets-"));

  const { fake, state } = makeFake();
  const bytes = pngBytes();
  const registered = await assets.registerControlledAsset(fake, { actorUserId: "owner-1", fileName: "a.png", contentType: "image/png", byteSize: bytes.length, sha256: sha256(bytes) });
  await assets.uploadControlledAssetBytes(fake, { assetId: registered.assetId, actorUserId: "owner-1", bytes });

  let scans = 0;
  const finalized = await assets.finalizeControlledAsset(fake, {
    assetId: registered.assetId,
    actorUserId: "owner-1",
    scanner: async () => { scans += 1; return "CLEAN"; },
  });
  assert.equal(finalized.assetId, registered.assetId);
  assert.equal(finalized.status, "READY");
  assert.equal(finalized.scanStatus, "CLEAN");
  assert.equal(scans, 1);
  assert.equal(state.audits.filter((a) => a.action === "asset.finalize" && a.result === "ready").length, 1);

  const again = await assets.finalizeControlledAsset(fake, {
    assetId: registered.assetId,
    actorUserId: "owner-1",
    scanner: async () => { throw new Error("扫描器不应被再次调用"); },
  });
  assert.equal(again.assetId, registered.assetId);
  assert.equal(again.status, "READY");
  assert.equal(again.scanStatus, "CLEAN");
  assert.equal(scans, 1, "二次 finalize 必须幂等返回当前状态");

  const reupload = await assets.uploadControlledAssetBytes(fake, { assetId: registered.assetId, actorUserId: "owner-1", bytes });
  assert.equal(reupload.status, 409);
  assert.equal(reupload.code, "INVALID_REQUEST");
});

test("finalizeControlledAsset：非所有者 403，缺失资产 404", async () => {
  const { fake } = makeFake();
  const denied = await assets.finalizeControlledAsset(fake, { assetId: "asset-x", actorUserId: "outsider-1" });
  assert.equal(denied.status, 404);
  assert.equal(denied.code, "ASSET_NOT_FOUND");

  const { fake: fake2 } = makeFake({ assets: [{ id: "asset-x", ownerUserId: "owner-1" }] });
  const forbidden = await assets.finalizeControlledAsset(fake2, { assetId: "asset-x", actorUserId: "owner-2" });
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.code, "ASSET_ACCESS_DENIED");
});

test("createEvidenceVersion：无 recordId/assetId/derivedFromAssetId → 400 INVALID_REQUEST", async () => {
  const { fake } = makeFake();
  const result = await assets.createEvidenceVersion(fake, { actorUserId: "owner-1", title: "v", snapshotJson: {} });
  assert.equal(result.status, 400);
  assert.equal(result.code, "INVALID_REQUEST");
});

test("createEvidenceVersion：PENDING 资产 → 409 ASSET_SCAN_PENDING，QUARANTINED → 409 ASSET_SCAN_FAILED", async () => {
  const { fake } = makeFake({ assets: [{ id: "asset-bad", ownerUserId: "owner-1", status: "QUARANTINED", scanStatus: "INFECTED" }] });
  const bytes = pngBytes();
  const pending = await assets.registerControlledAsset(fake, { actorUserId: "owner-1", fileName: "a.png", contentType: "image/png", byteSize: bytes.length, sha256: sha256(bytes) });
  const pendingResult = await assets.createEvidenceVersion(fake, { actorUserId: "owner-1", assetId: pending.assetId, title: "v1", snapshotJson: {} });
  assert.equal(pendingResult.status, 409);
  assert.equal(pendingResult.code, "ASSET_SCAN_PENDING");

  const quarantinedResult = await assets.createEvidenceVersion(fake, { actorUserId: "owner-1", assetId: "asset-bad", title: "v1", snapshotJson: {} });
  assert.equal(quarantinedResult.status, 409);
  assert.equal(quarantinedResult.code, "ASSET_SCAN_FAILED");
});

test("createEvidenceVersion：绑定 READY 资产成功且版本递增，非所有者 403", async () => {
  process.env.CONTROLLED_ASSET_STORAGE = "local";
  process.env.CONTROLLED_ASSET_LOCAL_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "cp-assets-"));

  const { fake, state } = makeFake();
  const { finalized } = await readyAsset(fake);

  const first = await assets.createEvidenceVersion(fake, { actorUserId: "owner-1", assetId: finalized.assetId, title: "v1", snapshotJson: { hash: "h1" } });
  assert.equal(first.version, 1);
  const second = await assets.createEvidenceVersion(fake, { actorUserId: "owner-1", assetId: finalized.assetId, title: "v2", snapshotJson: { hash: "h2" } });
  assert.equal(second.version, 2);
  assert.equal(state.evidenceVersions.length, 2);
  assert.equal(state.audits.filter((a) => a.action === "evidence.create").length, 2);

  const denied = await assets.createEvidenceVersion(fake, { actorUserId: "owner-2", assetId: finalized.assetId, title: "v3", snapshotJson: {} });
  assert.equal(denied.status, 403);
  assert.equal(denied.code, "ASSET_ACCESS_DENIED");
});

test("createEvidenceVersion：绑定记录需 WRITE 权限；只读授权 403、撤回 409、不存在 404、版本递增", async () => {
  const { fake, state } = makeFake({
    records: [
      { id: "rec-1", ownerUserId: "owner-1" },
      { id: "rec-w", ownerUserId: "owner-1", status: "WITHDRAWN" },
    ],
    grants: [{ subjectUserId: "reader-1", objectType: "scoped_record", objectId: "rec-1", action: "READ" }],
  });

  const first = await assets.createEvidenceVersion(fake, { actorUserId: "owner-1", recordId: "rec-1", title: "v1", snapshotJson: {} });
  assert.equal(first.version, 1);
  const second = await assets.createEvidenceVersion(fake, { actorUserId: "owner-1", recordId: "rec-1", title: "v2", snapshotJson: {} });
  assert.equal(second.version, 2);
  assert.equal(state.evidenceVersions.filter((row) => row.recordId === "rec-1").length, 2);

  const readOnly = await assets.createEvidenceVersion(fake, { actorUserId: "reader-1", recordId: "rec-1", title: "v3", snapshotJson: {} });
  assert.equal(readOnly.status, 403);
  assert.equal(readOnly.code, "RECORD_ACCESS_DENIED");

  const withdrawn = await assets.createEvidenceVersion(fake, { actorUserId: "owner-1", recordId: "rec-w", title: "v", snapshotJson: {} });
  assert.equal(withdrawn.status, 409);
  assert.equal(withdrawn.code, "RECORD_WITHDRAWN");

  const missing = await assets.createEvidenceVersion(fake, { actorUserId: "owner-1", recordId: "rec-missing", title: "v", snapshotJson: {} });
  assert.equal(missing.status, 404);
  assert.equal(missing.code, "RECORD_NOT_FOUND");
});

test("createEvidenceVersion：衍生版本要求原始资产读权 — outsider 403，原始资产所有者可创建", async () => {
  process.env.CONTROLLED_ASSET_STORAGE = "local";
  process.env.CONTROLLED_ASSET_LOCAL_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "cp-assets-"));

  const { fake, state } = makeFake();
  const { finalized } = await readyAsset(fake);

  const denied = await assets.createEvidenceVersion(fake, { actorUserId: "outsider-1", derivedFromAssetId: finalized.assetId, title: "subtitle", snapshotJson: {} });
  assert.equal(denied.status, 403);
  assert.equal(denied.code, "ASSET_ACCESS_DENIED");

  const created = await assets.createEvidenceVersion(fake, { actorUserId: "owner-1", derivedFromAssetId: finalized.assetId, title: "subtitle", snapshotJson: {} });
  assert.equal(created.version, 1);
  const row = state.evidenceVersions.find((r) => r.id === created.evidenceVersionId);
  assert.equal(row.derivedFromAssetId, finalized.assetId);
  assert.equal(row.recordId, null);
});

test("resolveAssetAccess：所有者与绑定记录可读，衍生链按 原始→衍生 方向继承", async () => {
  process.env.CONTROLLED_ASSET_STORAGE = "local";
  process.env.CONTROLLED_ASSET_LOCAL_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "cp-assets-"));

  const { fake, state } = makeFake({
    records: [{ id: "rec-1", ownerUserId: "owner-1" }],
    grants: [{ subjectUserId: "reader-1", objectType: "scoped_record", objectId: "rec-1", action: "READ" }],
  });
  const parent = await readyAsset(fake);
  const derived = await readyAsset(fake);
  const parentRow = state.controlledAssets.find((r) => r.id === parent.finalized.assetId);
  const derivedRow = state.controlledAssets.find((r) => r.id === derived.finalized.assetId);

  // 原始资产绑定到 rec-1；衍生资产经 derivedFromAssetId 指向原始资产
  await assets.createEvidenceVersion(fake, { actorUserId: "owner-1", recordId: "rec-1", assetId: parent.finalized.assetId, title: "p", snapshotJson: {} });
  await assets.createEvidenceVersion(fake, { actorUserId: "owner-1", assetId: derived.finalized.assetId, derivedFromAssetId: parent.finalized.assetId, title: "d", snapshotJson: {} });

  // 所有者恒可读；经绑定记录的 READ 授权也可读原始资产
  assert.equal((await assets.resolveAssetAccess(fake, parentRow, "owner-1", "read")).granted, true);
  assert.equal((await assets.resolveAssetAccess(fake, parentRow, "reader-1", "read")).granted, true);
  assert.equal((await assets.resolveAssetAccess(fake, parentRow, "outsider-1", "read")).granted, false);

  // 继承链方向（CP-FR-058「衍生文件继承权限」= 衍生资产的访问上限继承原始资产）：
  // 原始资产的读者可读取衍生资产；反向（衍生资产所有者据此读原始资产）不成立——
  // 读原始资产仍须对原始资产自身有授权。
  assert.equal((await assets.resolveAssetAccess(fake, derivedRow, "reader-1", "read")).granted, true);
  assert.equal((await assets.resolveAssetAccess(fake, parentRow, "owner-2", "read")).granted, false);

  // 端到端：reader-1 读取衍生资产元数据成功；outsider 403
  const read = await assets.readControlledAsset(fake, { assetId: derived.finalized.assetId, actorUserId: "reader-1" });
  assert.equal(read.asset.id, derived.finalized.assetId);
  const denied = await assets.readControlledAsset(fake, { assetId: derived.finalized.assetId, actorUserId: "outsider-1" });
  assert.equal(denied.status, 403);
  assert.equal(denied.code, "ASSET_ACCESS_DENIED");
});
