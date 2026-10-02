import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, stat } from "node:fs/promises";
import path from "node:path";

/**
 * 受控 Asset 的物理存储（CP-TODO-248 / CP-FR-058）。
 * 与证书产物存储同构：local / http 两种 provider，键为内容寻址
 * （assets/<ownerUserId>/<sha256>），读回时做完整性校验。
 * 访问授权由 controlled-assets 服务判定，本模块只做存取。
 */

export type StoredControlledAssetBytes = { provider: "local" | "http"; key: string; sha256: string; byteSize: number };

function storageConfig() {
  const mode = process.env.CONTROLLED_ASSET_STORAGE;
  if (mode !== "local" && mode !== "http") throw new Error("Controlled asset storage is not configured. Set CONTROLLED_ASSET_STORAGE to local or http.");
  if (mode === "local") {
    const root = process.env.CONTROLLED_ASSET_LOCAL_ROOT;
    if (!root || !path.isAbsolute(root)) throw new Error("CONTROLLED_ASSET_LOCAL_ROOT must be an absolute path for local controlled asset storage.");
    return { mode, root: path.resolve(root) } as const;
  }
  const baseUrl = process.env.CONTROLLED_ASSET_HTTP_BASE_URL;
  if (!baseUrl || !/^https?:\/\//.test(baseUrl)) throw new Error("CONTROLLED_ASSET_HTTP_BASE_URL must be an absolute HTTP URL.");
  return { mode, baseUrl: baseUrl.replace(/\/$/, ""), authorization: process.env.CONTROLLED_ASSET_HTTP_AUTHORIZATION } as const;
}

export function normalizeControlledAssetKey(key: string) {
  if (!/^assets\/[A-Za-z0-9_-]+\/[a-f0-9]{64}$/.test(key) || key.includes("..") || path.posix.normalize(key) !== key) {
    throw new Error("Invalid controlled asset key.");
  }
  return key;
}

export function plannedControlledAssetKey(ownerUserId: string, sha256: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(ownerUserId)) throw new Error("Invalid asset owner for storage key.");
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("Invalid asset digest for storage key.");
  return normalizeControlledAssetKey(`assets/${ownerUserId}/${sha256}`);
}

export function sha256Hex(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function putControlledAssetBytes(key: string, bytes: Buffer): Promise<StoredControlledAssetBytes> {
  const normalized = normalizeControlledAssetKey(key);
  const digest = sha256Hex(bytes);
  const config = storageConfig();
  if (config.mode === "local") {
    const destination = path.resolve(config.root, normalized);
    if (!destination.startsWith(`${config.root}${path.sep}`)) throw new Error("Invalid controlled asset storage path.");
    await mkdir(path.dirname(destination), { recursive: true });
    try {
      await stat(destination);
    } catch {
      const temporary = `${destination}.${randomUUID()}.tmp`;
      const handle = await open(temporary, "wx", 0o600);
      try { await handle.writeFile(bytes); } finally { await handle.close(); }
      try { await rename(temporary, destination); } catch (error) { try { await stat(destination); } catch { throw error; } }
    }
  } else {
    const response = await fetch(`${config.baseUrl}/${normalized}`, {
      method: "PUT",
      headers: {
        "content-type": "application/octet-stream",
        "content-length": String(bytes.length),
        "x-content-sha256": digest,
        ...(config.authorization ? { authorization: config.authorization } : {}),
      },
      body: bytes,
    });
    if (!response.ok) throw new Error(`Controlled asset HTTP storage PUT failed (${response.status}).`);
  }
  return { provider: config.mode, key: normalized, sha256: digest, byteSize: bytes.length };
}

export async function getControlledAssetBytes(stored: Pick<StoredControlledAssetBytes, "provider" | "key" | "sha256">): Promise<Buffer> {
  const key = normalizeControlledAssetKey(stored.key);
  const config = storageConfig();
  if (config.mode !== stored.provider) throw new Error("Controlled asset storage provider does not match persisted asset.");
  const bytes = config.mode === "local"
    ? await readFile(path.resolve(config.root, key))
    : await (async () => {
        const response = await fetch(`${config.baseUrl}/${key}`, { headers: config.authorization ? { authorization: config.authorization } : {} });
        if (!response.ok) throw new Error(`Controlled asset HTTP storage GET failed (${response.status}).`);
        return Buffer.from(await response.arrayBuffer());
      })();
  if (sha256Hex(bytes) !== stored.sha256) throw new Error("Controlled asset integrity check failed.");
  return bytes;
}
