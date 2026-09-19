import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, stat } from "node:fs/promises";
import path from "node:path";

const MAX_LEGACY_ARTIFACT_BYTES = 5 * 1024 * 1024;
const MAX_PDF_ARTIFACT_BYTES = 20 * 1024 * 1024;

export type CertificateArtifact = { bytes: Buffer; contentType: string; fileName: string };
export type StoredCertificateArtifact = { provider: "local" | "http"; key: string; version: string; byteSize: number; sha256: string; createdAt: Date; verifiedAt: Date };

function storageConfig() {
  const mode = process.env.CERTIFICATE_ARTIFACT_STORAGE;
  if (mode !== "local" && mode !== "http") throw new Error("Certificate artifact storage is not configured. Set CERTIFICATE_ARTIFACT_STORAGE to local or http.");
  if (mode === "local") {
    const root = process.env.CERTIFICATE_ARTIFACT_LOCAL_ROOT;
    if (!root || !path.isAbsolute(root)) throw new Error("CERTIFICATE_ARTIFACT_LOCAL_ROOT must be an absolute path for local certificate artifact storage.");
    return { mode, root: path.resolve(root) } as const;
  }
  const baseUrl = process.env.CERTIFICATE_ARTIFACT_HTTP_BASE_URL;
  if (!baseUrl || !/^https?:\/\//.test(baseUrl)) throw new Error("CERTIFICATE_ARTIFACT_HTTP_BASE_URL must be an absolute HTTP URL.");
  return { mode, baseUrl: baseUrl.replace(/\/$/, ""), authorization: process.env.CERTIFICATE_ARTIFACT_HTTP_AUTHORIZATION } as const;
}

export function normalizeCertificateArtifactKey(key: string) {
  if (!/^certificates\/[A-Za-z0-9_-]+\/[a-f0-9]{64}\.(?:html|pdf)$/.test(key) || key.includes("..") || path.posix.normalize(key) !== key) throw new Error("Invalid certificate artifact key.");
  return key;
}

function sha256(bytes: Buffer) { return createHash("sha256").update(bytes).digest("hex"); }
function httpHeaders(artifact: CertificateArtifact, hash: string, authorization?: string) {
  return { "content-type": artifact.contentType, "content-length": String(artifact.bytes.length), "x-content-sha256": hash, ...(authorization ? { authorization } : {}) };
}

export async function putCertificateArtifact(issueId: string, artifact: CertificateArtifact): Promise<StoredCertificateArtifact> {
  const config = storageConfig();
  const digest = sha256(artifact.bytes);
  const extension = artifact.contentType === "application/pdf" ? "pdf" : "html";
  const key = normalizeCertificateArtifactKey(`certificates/${issueId}/${digest}.${extension}`);
  const now = new Date();
  if (config.mode === "local") {
    const destination = path.resolve(config.root, key);
    if (!destination.startsWith(`${config.root}${path.sep}`)) throw new Error("Invalid certificate artifact storage path.");
    await mkdir(path.dirname(destination), { recursive: true });
    try {
      await stat(destination);
    } catch {
      const temporary = `${destination}.${randomUUID()}.tmp`;
      const handle = await open(temporary, "wx", 0o600);
      try { await handle.writeFile(artifact.bytes); } finally { await handle.close(); }
      try { await rename(temporary, destination); } catch (error) { try { await stat(destination); } catch { throw error; } }
    }
  } else {
    const response = await fetch(`${config.baseUrl}/${key}`, { method: "PUT", headers: httpHeaders(artifact, digest, config.authorization), body: artifact.bytes });
    if (!response.ok) throw new Error(`Certificate artifact HTTP storage PUT failed (${response.status}).`);
  }
  return { provider: config.mode, key, version: digest, byteSize: artifact.bytes.length, sha256: digest, createdAt: now, verifiedAt: now };
}

export async function getCertificateArtifact(stored: Pick<StoredCertificateArtifact, "provider" | "key" | "sha256">): Promise<Buffer> {
  const key = normalizeCertificateArtifactKey(stored.key);
  const config = storageConfig();
  if (config.mode !== stored.provider) throw new Error("Certificate artifact storage provider does not match persisted artifact.");
  const bytes = config.mode === "local"
    ? await readFile(path.resolve(config.root, key))
    : await (async () => { const response = await fetch(`${config.baseUrl}/${key}`, { headers: config.authorization ? { authorization: config.authorization } : {} }); if (!response.ok) throw new Error(`Certificate artifact HTTP storage GET failed (${response.status}).`); return Buffer.from(await response.arrayBuffer()); })();
  if (sha256(bytes) !== stored.sha256) throw new Error("Certificate artifact integrity check failed.");
  return bytes;
}

export function decodeLegacyCertificateArtifact(dataUrl: string): CertificateArtifact | null {
  const match = /^data:text\/html(?:;charset=utf-8)?,(.*)$/is.exec(dataUrl);
  if (!match) return null;
  let html: string;
  try { html = decodeURIComponent(match[1]); } catch { return null; }
  const bytes = Buffer.from(html, "utf8");
  return bytes.length <= MAX_LEGACY_ARTIFACT_BYTES ? { bytes, contentType: "text/html; charset=utf-8", fileName: "certificate.html" } : null;
}

export async function storeBuiltCertificateArtifact(issueId: string, built: { dataUrl?: string; bytes?: Buffer; fileName: string; mimeType: string }) {
  const artifact = built.mimeType === "application/pdf" && built.bytes && built.bytes.length <= MAX_PDF_ARTIFACT_BYTES
    ? { bytes: built.bytes, contentType: built.mimeType, fileName: built.fileName }
    : built.dataUrl
      ? decodeLegacyCertificateArtifact(built.dataUrl)
      : null;
  if (!artifact) throw new Error("Generated certificate artifact is not a valid bounded HTML or PDF artifact.");
  const stored = await putCertificateArtifact(issueId, { ...artifact, fileName: built.fileName, contentType: built.mimeType });
  return { generatedFileName: built.fileName, artifactProvider: stored.provider, artifactKey: stored.key, artifactVersion: stored.version, artifactContentType: built.mimeType, artifactByteSize: stored.byteSize, artifactSha256: stored.sha256, artifactCreatedAt: stored.createdAt, artifactVerifiedAt: stored.verifiedAt, artifactState: "READY" as const, artifactFailureReason: null };
}
