import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/server/auth";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { canDownloadCertificateStatus } from "@/lib/server/certificates";
import { decodeLegacyCertificateArtifact, getCertificateArtifact } from "@/lib/server/certificate-artifact-storage";
import { getPrismaClient } from "@/lib/server/prisma";

function safeFileName(value: string | null) {
  const normalized = (value ?? "certificate.html")
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F/\\:*?"<>|]/g, "_")
    .trim()
    .slice(0, 160);
  return normalized || "certificate.html";
}

function asciiFileName(value: string) {
  const extension = /\.[A-Za-z0-9]{1,8}$/.exec(value)?.[0] ?? ".html";
  const ascii = value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/[\\"]/g, "_")
    .trim();
  return /[A-Za-z0-9]/.test(ascii) ? ascii : `certificate${extension}`;
}

function rfc5987(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function contentDisposition(disposition: "inline" | "attachment", fileName: string) {
  return `${disposition}; filename="${asciiFileName(fileName)}"; filename*=UTF-8''${rfc5987(fileName)}`;
}

function artifactContentType(value: string | null | undefined) {
  return value && /^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+(?:;\s*charset=[A-Za-z0-9._-]+)?$/.test(value)
    ? value
    : "text/html; charset=utf-8";
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await requireAuthenticatedUser("en", "/en/certificates");
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  const issue = await prisma.certificateIssue.findUnique({ where: { id: params.id }, select: { id: true, userId: true, status: true, generatedFileUrl: true, generatedFileName: true, artifactProvider: true, artifactKey: true, artifactSha256: true, artifactContentType: true, artifactState: true } });
  if (!issue) return NextResponse.json({ error: "Certificate not found." }, { status: 404 });
  if (issue.userId !== user.id && user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!canDownloadCertificateStatus(issue.status)) return NextResponse.json({ error: "Certificate is not downloadable." }, { status: 409 });
  let bytes: Buffer;
  let contentType = artifactContentType(issue.artifactContentType);
  if (issue.artifactState === "READY" && issue.artifactProvider && issue.artifactKey && issue.artifactSha256) {
    try { bytes = await getCertificateArtifact({ provider: issue.artifactProvider as "local" | "http", key: issue.artifactKey, sha256: issue.artifactSha256 }); }
    catch { await prisma.certificateIssue.update({ where: { id: issue.id }, data: { artifactState: "MISSING", artifactFailureReason: "Artifact unavailable or failed integrity verification." } }); return NextResponse.json({ error: "Certificate artifact is unavailable." }, { status: 404 }); }
  } else {
    const legacy = issue.generatedFileUrl ? decodeLegacyCertificateArtifact(issue.generatedFileUrl) : null;
    if (!legacy) return NextResponse.json({ error: "Certificate artifact is unavailable." }, { status: 404 });
    bytes = legacy.bytes;
    contentType = artifactContentType(legacy.contentType);
    if (issue.artifactState === "NONE") {
      try {
        await prisma.certificateIssue.update({ where: { id: issue.id }, data: { artifactState: "LEGACY_INLINE" } });
      } catch {
        return NextResponse.json({ error: "Certificate artifact state could not be persisted." }, { status: 503 });
      }
    }
  }
  const disposition = new URL(request.url).searchParams.get("disposition") === "inline" ? "inline" : "attachment";
  if (disposition === "attachment") {
    try {
      await prisma.certificateIssue.update({ where: { id: issue.id }, data: { downloadCount: { increment: 1 } } });
    } catch {
      return NextResponse.json({ error: "Certificate download could not be recorded." }, { status: 503 });
    }
    await writeCoreAuditLog({ actorUserId: user.id, action: "certificate.download", subjectType: "certificate_issue", subjectId: issue.id, result: "artifact_served", ...getRequestAuditContext(request) }).catch(() => undefined);
  }
  const fileName = safeFileName(issue.generatedFileName);
  return new NextResponse(bytes, { headers: { "content-type": contentType, "content-length": String(bytes.length), "content-disposition": contentDisposition(disposition, fileName), "cache-control": "private, no-store", "x-content-type-options": "nosniff", ...(disposition === "inline" ? { "content-security-policy": "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline';" } : {}) } });
}
