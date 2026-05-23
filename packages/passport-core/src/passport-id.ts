import { randomBytes as nodeRandomBytes } from "crypto";

export const PASSPORT_ID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const PASSPORT_ID_BODY_LENGTH = 13;
export const PASSPORT_ID_FORMAT = "XXXXXXX-XXXXXX";
export const PASSPORT_ID_MAX_ALLOCATION_ATTEMPTS = 10;

const PASSPORT_ID_PATTERN = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{7}-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{6}$/;

export type PassportIdRandomBytes = (length: number) => Uint8Array;
export type PassportIdCollisionLookup = (candidate: string) => Promise<boolean>;

export function normalizeClimatePassportId(value: string) {
  return value.trim().toUpperCase();
}

export function isClimatePassportId(value: string) {
  return PASSPORT_ID_PATTERN.test(normalizeClimatePassportId(value));
}

export function buildClimatePassportId(body: string) {
  const normalizedBody = normalizeClimatePassportId(body).replace(/-/g, "");

  if (
    normalizedBody.length !== PASSPORT_ID_BODY_LENGTH ||
    [...normalizedBody].some((char) => !PASSPORT_ID_ALPHABET.includes(char))
  ) {
    throw new Error(`Climate Passport ID body must be ${PASSPORT_ID_BODY_LENGTH} valid characters.`);
  }

  return `${normalizedBody.slice(0, 7)}-${normalizedBody.slice(7)}`;
}

export function generateClimatePassportIdCandidate(randomBytes: PassportIdRandomBytes = nodeRandomBytes) {
  const bytes = randomBytes(PASSPORT_ID_BODY_LENGTH);
  let body = "";

  for (let index = 0; index < PASSPORT_ID_BODY_LENGTH; index += 1) {
    body += PASSPORT_ID_ALPHABET[bytes[index] % PASSPORT_ID_ALPHABET.length];
  }

  return buildClimatePassportId(body);
}

export async function allocateClimatePassportId(
  hasCollision: PassportIdCollisionLookup,
  options: {
    maxAttempts?: number;
    randomBytes?: PassportIdRandomBytes;
  } = {},
) {
  const maxAttempts = options.maxAttempts ?? PASSPORT_ID_MAX_ALLOCATION_ATTEMPTS;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = generateClimatePassportIdCandidate(options.randomBytes);

    if (!(await hasCollision(candidate))) {
      return candidate;
    }
  }

  throw new Error("Unable to allocate a unique Climate Passport ID.");
}
