import { isIP } from "node:net";

/**
 * IP / CIDR allowlist matching for server-to-server callers.
 *
 * An API key that leaks into a browser is caught by the Origin check, but backend
 * integrations send no Origin at all — for those the source address is the only thing
 * the platform can pin. Addresses are compared numerically, because string equality
 * would let an odd spelling of the same address slip past an entry. Anything this module
 * cannot parse matches nothing, so a malformed entry can never widen access.
 */

type IpFamily = 4 | 6;

const MAX_BITS: Record<IpFamily, number> = { 4: 32, 6: 128 };

function parseOctets(value: string): number[] | null {
  const groups = value.split(".");
  if (groups.length !== 4) return null;
  const bytes: number[] = [];
  for (const group of groups) {
    // Leading zeros are rejected: some resolvers read them as octal, so one string can
    // mean two different addresses.
    if (!/^\d{1,3}$/.test(group) || (group.length > 1 && group.startsWith("0"))) return null;
    const parsed = Number(group);
    if (parsed > 255) return null;
    bytes.push(parsed);
  }
  return bytes;
}

function parseHexGroup(value: string): number | null {
  return /^[0-9a-fA-F]{1,4}$/.test(value) ? Number.parseInt(value, 16) : null;
}

function parseHexSide(side: string): number[] | null {
  if (side === "") return [];
  const groups: number[] = [];
  for (const part of side.split(":")) {
    const parsed = parseHexGroup(part);
    if (parsed === null) return null;
    groups.push(parsed);
  }
  return groups;
}

/** The eight 16-bit groups of an IPv6 address, expanding `::` and a trailing embedded IPv4. */
function expandIpv6(value: string): number[] | null {
  let head = value;
  let tail: number[] = [];

  const embedded = head.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (embedded) {
    const octets = parseOctets(embedded[1]);
    if (!octets) return null;
    tail = [(octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]];
    head = head.slice(0, head.length - embedded[1].length);
    if (head.endsWith(":")) head = head.slice(0, -1);
  }

  const halves = head.split("::");
  if (halves.length > 2) return null;

  if (halves.length === 1) {
    const groups = parseHexSide(head);
    if (!groups) return null;
    const all = [...groups, ...tail];
    return all.length === 8 ? all : null;
  }

  const left = parseHexSide(halves[0] ?? "");
  const right = parseHexSide((halves[1] ?? "").replace(/^:/, ""));
  if (!left || !right) return null;
  const known = left.length + right.length + tail.length;
  if (known > 7) return null; // `::` must stand for at least one zero group
  return [...left, ...Array.from({ length: 8 - known }, () => 0), ...right, ...tail];
}

function toBytes(value: string): { family: IpFamily; bytes: number[] } | null {
  const trimmed = value.trim();
  const family = isIP(trimmed);
  if (family === 4) {
    const bytes = parseOctets(trimmed);
    return bytes ? { family: 4, bytes } : null;
  }
  if (family === 6) {
    const groups = expandIpv6(trimmed);
    if (!groups) return null;
    // Normalize the IPv4-mapped form (`::ffff:10.0.0.1`) down to v4, so a proxy that
    // reports `::ffff:`-prefixed clients still matches an `allowedIps` entry written as v4.
    if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
      return { family: 4, bytes: [(groups[6] >> 8) & 0xff, groups[6] & 0xff, (groups[7] >> 8) & 0xff, groups[7] & 0xff] };
    }
    const bytes: number[] = [];
    for (const group of groups) bytes.push((group >> 8) & 0xff, group & 0xff);
    return { family: 6, bytes };
  }
  return null;
}

export function isValidIpAddress(value: string): boolean {
  return toBytes(value) !== null;
}

/** Accepts a bare address or `<address>/<prefix>` of the same family. */
export function isValidIpOrCidr(value: string): boolean {
  const entry = value.trim();
  const slashIndex = entry.indexOf("/");
  if (slashIndex === -1) return isValidIpAddress(entry);
  const target = toBytes(entry.slice(0, slashIndex));
  const prefixText = entry.slice(slashIndex + 1);
  if (!target || !/^\d{1,3}$/.test(prefixText)) return false;
  return Number(prefixText) <= MAX_BITS[target.family];
}

function mask(bytes: number[], prefix: number): number[] {
  return bytes.map((byte, index) => {
    const bitStart = index * 8;
    if (bitStart + 8 <= prefix) return byte;
    if (bitStart >= prefix) return 0;
    const keep = prefix - bitStart;
    return byte & ((0xff << (8 - keep)) & 0xff);
  });
}

/**
 * True when `address` is covered by `entries`. An empty list means "no IP constraint";
 * deciding whether that is acceptable is the caller's job, not this function's.
 */
export function ipInAllowlist(address: string, entries: readonly string[]): boolean {
  const target = toBytes(address);
  if (!target) return false;
  for (const rawEntry of entries) {
    const entry = rawEntry.trim();
    if (!entry) continue;
    const slashIndex = entry.indexOf("/");
    const host = toBytes(slashIndex === -1 ? entry : entry.slice(0, slashIndex));
    if (!host || host.family !== target.family) continue;
    let prefix = MAX_BITS[host.family];
    if (slashIndex !== -1) {
      const prefixText = entry.slice(slashIndex + 1);
      if (!/^\d{1,3}$/.test(prefixText)) continue;
      prefix = Number(prefixText);
      if (prefix > MAX_BITS[host.family]) continue;
    }
    const maskedTarget = mask(target.bytes, prefix);
    const maskedEntry = mask(host.bytes, prefix);
    if (maskedTarget.every((byte, index) => byte === maskedEntry[index])) return true;
  }
  return false;
}
