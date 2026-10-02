import type { Prisma, PrismaClient } from "@prisma/client";
import { resolveRecordAccess, type PrivateRecordError } from "./private-records";
import {
  getControlledAssetBytes,
  plannedControlledAssetKey,
  putControlledAssetBytes,
  sha256Hex,
} from "./controlled-asset-storage";

/**
 * CP-TODO-248：受控上传/finalize、不可变证据版本、衍生文件权限继承（CP-FR-058）。
 *
 * 原则：
 * - 登记时声明 contentType/byteSize/sha256；实际上传字节必须同时通过完整性
 *   （大小 + sha256）与真实类型校验（magic bytes 嗅探，错误 MIME 拒绝）；
 *   任意外链不能替代私有 Asset（CP-FR-058）。
 * - finalize 运行扫描门禁：扫描未完成（PENDING）不得使用/公开；INFECTED 进入
 *   QUARANTINED。默认扫描器不做病毒库判断（生产接入外部扫描服务），管理员可
 *   检疫（quarantine）处置。
 * - 图片落盘前剥离定位元数据（JPEG EXIF APP1 / PNG eXIf）；剥离后重算存储摘要。
 * - 衍生文件（字幕/译文/剪辑/缩略图）经 EvidenceVersion.derivedFromAssetId 建立
 *   继承链：读取衍生资产要求对原始资产（或其绑定记录）有读权。
 * - hash 校验只证明完整性，不构成事实核验（CP-FR-058）。
 */

export type AssetError = PrivateRecordError;

type PrismaLike = Pick<PrismaClient,
  | "controlledAsset"
  | "evidenceVersion"
  | "scopedRecord"
  | "recordRevision"
  | "objectAuthorization"
  | "programme"
  | "edition"
  | "accessMembership"
  | "institutionRepresentation"
  | "sourceObjectMapping"
  | "user"
  | "coreAuditLog"> & {
    $transaction: PrismaClient["$transaction"];
  };

export type AssetScanVerdict = "CLEAN" | "INFECTED";
export type AssetScanner = (bytes: Buffer, contentType: string) => Promise<AssetScanVerdict>;

/** 默认扫描器：生产环境应替换为外部扫描服务；默认不做病毒库断言。 */
export const defaultAssetScanner: AssetScanner = async () => "CLEAN";

const MAX_ASSET_BYTES = 100 * 1024 * 1024;

export const ALLOWED_ASSET_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
] as const;

function assetError(error: string, status: number, code: string): AssetError {
  return { error, status, code };
}

export function normalizeDeclaredContentType(contentType: string) {
  return contentType.split(";")[0].trim().toLowerCase();
}

/** magic-bytes 嗅探；无匹配返回 application/octet-stream。 */
export function sniffContentType(bytes: Buffer): string {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 6 && bytes.toString("ascii", 0, 3) === "GIF") return "image/gif";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (bytes.length >= 5 && bytes.toString("ascii", 0, 5) === "%PDF-") return "application/pdf";
  if (bytes.length >= 1024) return "application/octet-stream";
  if (isPlausibleText(bytes)) return "text/plain";
  return "application/octet-stream";
}

function isPlausibleText(bytes: Buffer) {
  const probe = bytes.subarray(0, Math.min(bytes.length, 4096));
  if (probe.includes(0x00)) return false;
  for (const byte of probe) {
    if (byte < 0x09 || (byte > 0x0d && byte < 0x20)) return false;
  }
  return true;
}

/**
 * 去除定位元数据：JPEG 剥掉 APP1（EXIF）段，PNG 去掉 eXIf chunk。
 * 返回剥离后的字节与是否发生过修改。
 */
export function stripLocationMetadata(bytes: Buffer, contentType: string): { bytes: Buffer; stripped: boolean } {
  if (contentType === "image/jpeg") return stripJpegExif(bytes);
  if (contentType === "image/png") return stripPngExif(bytes);
  return { bytes, stripped: false };
}

function stripJpegExif(bytes: Buffer): { bytes: Buffer; stripped: boolean } {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return { bytes, stripped: false };
  const segments: Buffer[] = [bytes.subarray(0, 2)];
  let offset = 2;
  let stripped = false;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    // Standalone markers without length.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      segments.push(bytes.subarray(offset, offset + 2));
      offset += 2;
      if (marker === 0xda) break; // SOS: image data follows, copy the rest below.
      continue;
    }
    const length = bytes.readUInt16BE(offset + 2);
    const end = offset + 2 + length;
    if (end > bytes.length) break;
    if (marker === 0xe1) {
      stripped = true; // APP1 (EXIF / XMP): drop the segment entirely.
    } else {
      segments.push(bytes.subarray(offset, end));
    }
    offset = end;
    if (marker === 0xda) break;
  }
  if (offset < bytes.length) segments.push(bytes.subarray(offset));
  return { bytes: stripped ? Buffer.concat(segments) : bytes, stripped };
}

function stripPngExif(bytes: Buffer): { bytes: Buffer; stripped: boolean } {
  if (bytes.length < 8 || bytes.toString("ascii", 1, 4) !== "PNG") return { bytes, stripped: false };
  const signature = bytes.subarray(0, 8);
  const chunks: Buffer[] = [signature];
  let offset = 8;
  let stripped = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > bytes.length) break;
    if (type === "eXIf") {
      stripped = true;
    } else {
      chunks.push(bytes.subarray(offset, end));
    }
    offset = end;
    if (type === "IEND") break;
  }
  if (offset < bytes.length) chunks.push(bytes.subarray(offset));
  return { bytes: stripped ? Buffer.concat(chunks) : bytes, stripped };
}

function assertUsableForEvidence(asset: { status: string; scanStatus: string }): AssetError | null {
  if (asset.scanStatus === "PENDING") return assetError("Asset scan is pending; finalize before use.", 409, "ASSET_SCAN_PENDING");
  if (asset.scanStatus === "INFECTED" || asset.status === "QUARANTINED") {
    return assetError("Asset failed scanning and is quarantined.", 409, "ASSET_SCAN_FAILED");
  }
  if (asset.status !== "READY") return assetError("Asset is not finalized.", 409, "ASSET_SCAN_PENDING");
  return null;
}

/** 登记受控资产：声明 fileName/contentType/byteSize/sha256；存储键内容寻址。 */
export async function registerControlledAsset(
  prisma: PrismaLike,
  input: {
    actorUserId: string;
    fileName: string;
    contentType: string;
    byteSize: number;
    sha256: string;
    purpose?: string;
  },
): Promise<{ assetId: string; storageKey: string } | AssetError> {
  const contentType = normalizeDeclaredContentType(input.contentType);
  if (!(ALLOWED_ASSET_CONTENT_TYPES as readonly string[]).includes(contentType)) {
    return assetError(`Content type ${contentType || input.contentType} is not allowed for controlled assets.`, 400, "ASSET_CONTENT_TYPE_MISMATCH");
  }
  if (input.byteSize < 1 || input.byteSize > MAX_ASSET_BYTES) {
    return assetError("Asset byteSize is out of bounds.", 400, "INVALID_REQUEST");
  }
  if (!/^[a-f0-9]{64}$/.test(input.sha256)) {
    return assetError("sha256 must be a lowercase hex digest.", 400, "INVALID_REQUEST");
  }

  const storageKey = plannedControlledAssetKey(input.actorUserId, input.sha256);
  try {
    const asset = await prisma.controlledAsset.create({
      data: {
        ownerUserId: input.actorUserId,
        fileName: input.fileName,
        contentType,
        byteSize: input.byteSize,
        sha256: input.sha256,
        storageKey,
        purpose: input.purpose ?? "evidence",
        scanStatus: "PENDING",
        status: "UPLOADED",
      },
      select: { id: true },
    });
    await prisma.coreAuditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "asset.register",
        subjectType: "controlled_asset",
        subjectId: asset.id,
        result: "registered",
        metadataJson: { fileName: input.fileName, contentType, byteSize: input.byteSize },
      },
    });
    return { assetId: asset.id, storageKey };
  } catch (error) {
    console.error("controlled asset register failed:", error);
    return assetError("Asset register failed. No state was changed.", 500, "INTERNAL_ERROR");
  }
}

/**
 * 上传字节：先过完整性（大小 + 声明 sha256），再过真实类型嗅探（错误 MIME 拒绝），
 * 随后剥离定位元数据并落盘；扫描仍在 finalize 执行，期间资产不可用。
 */
export async function uploadControlledAssetBytes(
  prisma: PrismaLike,
  input: {
    assetId: string;
    actorUserId: string;
    bytes: Buffer;
  },
): Promise<{ assetId: string; byteSize: number; sha256: string; locationMetadataStripped: boolean } | AssetError> {
  const asset = await prisma.controlledAsset.findUnique({ where: { id: input.assetId } });
  if (!asset) return assetError("Asset not found.", 404, "ASSET_NOT_FOUND");
  if (asset.ownerUserId !== input.actorUserId) return assetError("Forbidden", 403, "ASSET_ACCESS_DENIED");
  if (asset.status !== "UPLOADED") return assetError("Asset bytes were already uploaded.", 409, "INVALID_REQUEST");

  if (input.bytes.length !== asset.byteSize) {
    return assetError("Uploaded bytes do not match the declared byteSize.", 400, "ASSET_INTEGRITY_MISMATCH");
  }
  if (sha256Hex(input.bytes) !== asset.sha256) {
    return assetError("Uploaded bytes do not match the declared sha256.", 400, "ASSET_INTEGRITY_MISMATCH");
  }
  const sniffed = sniffContentType(input.bytes);
  if (sniffed !== asset.contentType) {
    return assetError(`Detected content type ${sniffed} does not match the declared type.`, 400, "ASSET_CONTENT_TYPE_MISMATCH");
  }

  const stripped = stripLocationMetadata(input.bytes, asset.contentType);
  try {
    const stored = await putControlledAssetBytes(asset.storageKey, stripped.bytes);
    await prisma.controlledAsset.update({
      where: { id: asset.id },
      data: {
        sha256: stored.sha256,
        byteSize: stored.byteSize,
        storageKey: stored.key,
      },
      select: { id: true },
    });
    await prisma.coreAuditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "asset.upload",
        subjectType: "controlled_asset",
        subjectId: asset.id,
        result: "uploaded",
        metadataJson: { byteSize: stored.byteSize, locationMetadataStripped: stripped.stripped },
      },
    });
    return { assetId: asset.id, byteSize: stored.byteSize, sha256: stored.sha256, locationMetadataStripped: stripped.stripped };
  } catch (error) {
    console.error("controlled asset upload failed:", error);
    return assetError("Asset upload failed. No state was changed.", 500, "INTERNAL_ERROR");
  }
}

/** finalize：从存储回读校验完整性，运行扫描门禁；CLEAN → READY，INFECTED → QUARANTINED。 */
export async function finalizeControlledAsset(
  prisma: PrismaLike,
  input: { assetId: string; actorUserId: string; scanner?: AssetScanner },
): Promise<{ assetId: string; status: string; scanStatus: string } | AssetError> {
  const asset = await prisma.controlledAsset.findUnique({ where: { id: input.assetId } });
  if (!asset) return assetError("Asset not found.", 404, "ASSET_NOT_FOUND");
  if (asset.ownerUserId !== input.actorUserId) return assetError("Forbidden", 403, "ASSET_ACCESS_DENIED");

  if (asset.scanStatus !== "PENDING") {
    return { assetId: asset.id, status: asset.status, scanStatus: asset.scanStatus };
  }

  let bytes: Buffer;
  try {
    bytes = await getControlledAssetBytes({ provider: storageProvider(asset.storageKey), key: asset.storageKey, sha256: asset.sha256 });
  } catch (error) {
    console.error("controlled asset finalize read failed:", error);
    return assetError("Stored asset bytes could not be verified; re-upload the asset.", 409, "ASSET_INTEGRITY_MISMATCH");
  }

  const scanner = input.scanner ?? defaultAssetScanner;
  const verdict = await scanner(bytes, asset.contentType);
  const now = new Date();
  const status = verdict === "CLEAN" ? "READY" : "QUARANTINED";
  await prisma.controlledAsset.update({
    where: { id: asset.id },
    data: { scanStatus: verdict, scanCheckedAt: now, status },
    select: { id: true },
  });
  await prisma.coreAuditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: verdict === "CLEAN" ? "asset.finalize" : "asset.quarantine",
      subjectType: "controlled_asset",
      subjectId: asset.id,
      result: status.toLowerCase(),
      metadataJson: { scanStatus: verdict },
    },
  });
  return { assetId: asset.id, status, scanStatus: verdict };
}

function storageProvider(_key: string): "local" | "http" {
  const mode = process.env.CONTROLLED_ASSET_STORAGE;
  if (mode === "local" || mode === "http") return mode;
  throw new Error("Controlled asset storage is not configured.");
}

/** 管理员检疫：立即将资产标记为扫描失败并隔离。 */
export async function quarantineControlledAsset(
  prisma: PrismaLike,
  input: { assetId: string; actorUserId: string; reason: string },
): Promise<{ assetId: string } | AssetError> {
  if (!input.reason?.trim()) return assetError("A quarantine reason is required.", 400, "INVALID_REQUEST");
  const asset = await prisma.controlledAsset.findUnique({ where: { id: input.assetId }, select: { id: true } });
  if (!asset) return assetError("Asset not found.", 404, "ASSET_NOT_FOUND");

  await prisma.controlledAsset.update({
    where: { id: asset.id },
    data: { scanStatus: "INFECTED", scanCheckedAt: new Date(), status: "QUARANTINED" },
    select: { id: true },
  });
  await prisma.coreAuditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: "asset.quarantine",
      subjectType: "controlled_asset",
      subjectId: asset.id,
      result: "quarantined",
      metadataJson: { reason: input.reason },
    },
  });
  return { assetId: asset.id };
}

/** 资产访问：所有者，或经由证据版本绑定到可读记录，或衍生链继承原始资产读权。 */
export async function resolveAssetAccess(
  prisma: PrismaLike,
  asset: { id: string; ownerUserId: string; status: string },
  actorUserId: string | null,
  action: "read" | "write",
  depth = 0,
): Promise<{ granted: boolean }> {
  if (!actorUserId) return { granted: false };
  if (asset.ownerUserId === actorUserId) return { granted: true };
  if (action === "write") return { granted: false };
  if (depth >= 5) return { granted: false };
  // 注意：QUARANTINED 不影响访问判定本身——访问与可用性分离，
  // 已授权读者的下载由 readControlledAssetContent 的扫描门统一 409。

  const versions = await prisma.evidenceVersion.findMany({
    where: { OR: [{ assetId: asset.id }, { derivedFromAssetId: asset.id }] },
    select: { recordId: true, derivedFromAssetId: true, assetId: true },
  });
  for (const version of versions) {
    if (version.recordId) {
      const record = await prisma.scopedRecord.findUnique({
        where: { id: version.recordId },
        select: { id: true, ownerUserId: true, programmeId: true },
      });
      if (record) {
        const access = await resolveRecordAccess(prisma, record, actorUserId, "read");
        if (access.granted) return { granted: true };
      }
    }
    const parentAssetId = version.assetId === asset.id ? version.derivedFromAssetId : null;
    if (parentAssetId) {
      const parent = await prisma.controlledAsset.findUnique({
        where: { id: parentAssetId },
        select: { id: true, ownerUserId: true, status: true },
      });
      if (parent) {
        const inherited = await resolveAssetAccess(prisma, parent, actorUserId, "read", depth + 1);
        if (inherited.granted) return { granted: true };
      }
    }
  }
  return { granted: false };
}

/** 读取资产元数据（不含字节）。 */
export async function readControlledAsset(
  prisma: PrismaLike,
  input: { assetId: string; actorUserId: string | null },
): Promise<{ asset: Record<string, unknown> } | AssetError> {
  const asset = await prisma.controlledAsset.findUnique({ where: { id: input.assetId } });
  if (!asset) return assetError("Asset not found.", 404, "ASSET_NOT_FOUND");
  const access = await resolveAssetAccess(prisma, asset, input.actorUserId, "read");
  if (!access.granted) return assetError("Forbidden", 403, "ASSET_ACCESS_DENIED");
  return { asset: asset as unknown as Record<string, unknown> };
}

/** 下载资产字节：访问判定同上，且资产须通过扫描门禁。 */
export async function readControlledAssetContent(
  prisma: PrismaLike,
  input: { assetId: string; actorUserId: string | null },
): Promise<{ asset: Record<string, unknown>; bytes: Buffer } | AssetError> {
  const asset = await prisma.controlledAsset.findUnique({ where: { id: input.assetId } });
  if (!asset) return assetError("Asset not found.", 404, "ASSET_NOT_FOUND");
  const unusable = assertUsableForEvidence(asset);
  if (asset.ownerUserId === input.actorUserId) {
    // 所有者可见自己资产的扫描状态。
    if (unusable) return unusable;
  } else {
    // 非所有者先做访问判定，避免向无授权者泄漏扫描状态。
    const access = await resolveAssetAccess(prisma, asset, input.actorUserId, "read");
    if (!access.granted) return assetError("Forbidden", 403, "ASSET_ACCESS_DENIED");
    if (unusable) return unusable;
  }

  try {
    const bytes = await getControlledAssetBytes({ provider: storageProvider(asset.storageKey), key: asset.storageKey, sha256: asset.sha256 });
    return { asset: asset as unknown as Record<string, unknown>, bytes };
  } catch (error) {
    console.error("controlled asset read failed:", error);
    return assetError("Stored asset could not be verified.", 500, "INTERNAL_ERROR");
  }
}

/**
 * 创建不可变证据/媒体版本：可绑定记录（WRITE 权限）、受控资产（须 READY）
 * 或衍生关系（要求对原始资产的读权，衍生文件继承其权限）。
 */
export async function createEvidenceVersion(
  prisma: PrismaLike,
  input: {
    actorUserId: string;
    recordId?: string | null;
    assetId?: string | null;
    derivedFromAssetId?: string | null;
    title: string;
    snapshotJson: Record<string, unknown>;
  },
): Promise<{ evidenceVersionId: string; version: number } | AssetError> {
  if (!input.recordId && !input.assetId && !input.derivedFromAssetId) {
    return assetError("At least one of recordId, assetId or derivedFromAssetId is required.", 400, "INVALID_REQUEST");
  }

  const record = input.recordId
    ? await prisma.scopedRecord.findUnique({
        where: { id: input.recordId },
        select: { id: true, ownerUserId: true, programmeId: true, status: true },
      })
    : null;
  if (input.recordId && !record) return assetError("Record not found.", 404, "RECORD_NOT_FOUND");
  if (record && record.status !== "ACTIVE") return assetError("Record is withdrawn.", 409, "RECORD_WITHDRAWN");

  const asset = input.assetId
    ? await prisma.controlledAsset.findUnique({ where: { id: input.assetId } })
    : null;
  if (input.assetId && !asset) return assetError("Asset not found.", 404, "ASSET_NOT_FOUND");
  if (asset) {
    if (asset.ownerUserId !== input.actorUserId) return assetError("Forbidden", 403, "ASSET_ACCESS_DENIED");
    const unusable = assertUsableForEvidence(asset);
    if (unusable) return unusable;
  }

  const parentAsset = input.derivedFromAssetId
    ? await prisma.controlledAsset.findUnique({ where: { id: input.derivedFromAssetId } })
    : null;
  if (input.derivedFromAssetId && !parentAsset) return assetError("Source asset not found.", 404, "ASSET_NOT_FOUND");
  if (parentAsset) {
    const parentAccess = await resolveAssetAccess(prisma, parentAsset, input.actorUserId, "read");
    if (!parentAccess.granted) return assetError("Forbidden", 403, "ASSET_ACCESS_DENIED");
    const unusable = assertUsableForEvidence(parentAsset);
    if (unusable) return unusable;
  }

  if (record) {
    const access = await resolveRecordAccess(prisma, record, input.actorUserId, "write");
    if (!access.granted) return assetError("Forbidden", 403, "RECORD_ACCESS_DENIED");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      let version = 1;
      if (record) {
        const latest = await tx.evidenceVersion.findFirst({
          where: { recordId: record.id },
          select: { version: true },
          orderBy: { version: "desc" },
        });
        version = (latest?.version ?? 0) + 1;
      } else {
        const existing = await tx.evidenceVersion.findMany({
          where: {
            recordId: null,
            OR: [{ assetId: input.assetId ?? "" }, { derivedFromAssetId: input.derivedFromAssetId ?? "" }],
          },
          select: { version: true },
        });
        version = existing.reduce((max, row) => Math.max(max, row.version), 0) + 1;
      }

      const evidence = await tx.evidenceVersion.create({
        data: {
          recordId: record?.id ?? null,
          assetId: asset?.id ?? null,
          derivedFromAssetId: parentAsset?.id ?? null,
          version,
          title: input.title,
          snapshotJson: input.snapshotJson as Prisma.InputJsonValue,
          createdById: input.actorUserId,
        },
        select: { id: true, version: true },
      });
      await tx.coreAuditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "evidence.create",
          subjectType: "evidence_version",
          subjectId: evidence.id,
          result: "created",
          metadataJson: {
            recordId: record?.id ?? null,
            assetId: asset?.id ?? null,
            derivedFromAssetId: parentAsset?.id ?? null,
            version,
          },
        },
      });
      return { evidenceVersionId: evidence.id, version: evidence.version };
    });
  } catch (error) {
    console.error("evidence version create failed:", error);
    return assetError("Evidence version create failed. No state was changed.", 500, "INTERNAL_ERROR");
  }
}
