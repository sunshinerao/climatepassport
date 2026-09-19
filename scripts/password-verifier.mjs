/**
 * Strict bcrypt password verifier used by credential-hardening scripts.
 *
 * Only full bcrypt verifier strings are accepted:
 *   $2a$, $2b$, $2y$ prefix, two-digit cost, 22-character salt, 31-character hash.
 * Anything else is treated as non-bcrypt and fails closed.
 */

const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

// Any string beginning with the bcrypt modular crypt prefix `$2` that is not a
// full, valid verifier is treated as a malformed bcrypt attempt.
const BCRYPT_LIKE_PREFIX_REGEX = /^\$2/;

export function isValidBcryptHash(value) {
  return typeof value === "string" && BCRYPT_HASH_REGEX.test(value);
}

export function isBcryptLike(value) {
  return typeof value === "string" && BCRYPT_LIKE_PREFIX_REGEX.test(value);
}

export async function verifyBcryptPassword(storedPassword, inputPassword) {
  if (!isValidBcryptHash(storedPassword)) {
    return false;
  }

  const { compare } = await import("bcryptjs");

  try {
    return await compare(inputPassword, storedPassword);
  } catch {
    return false;
  }
}
