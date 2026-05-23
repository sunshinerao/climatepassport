import { createHash, randomBytes } from "crypto";

export const QR_TOKEN_BYTES = 32;
export const CERTIFICATE_VERIFICATION_CODE_BYTES = 12;

export function createOpaqueToken(bytes = QR_TOKEN_BYTES) {
  return randomBytes(bytes).toString("base64url");
}

export function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createCertificateVerificationCode() {
  return `CV-${createOpaqueToken(CERTIFICATE_VERIFICATION_CODE_BYTES).toUpperCase()}`;
}

export function maskPassportId(passportId: string | null | undefined) {
  if (!passportId) {
    return null;
  }

  const normalized = passportId.trim().toUpperCase();

  if (normalized.length <= 5) {
    return normalized;
  }

  return `${normalized.slice(0, 2)}••••${normalized.slice(-3)}`;
}
