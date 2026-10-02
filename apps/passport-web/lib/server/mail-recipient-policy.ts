/** An optional configured recipient restriction; unset preserves normal deployments. */
export function isMailRecipientAllowed(recipient: unknown, env: Record<string, string | undefined> = process.env): boolean {
  const configured = env.MAIL_RECIPIENT_ALLOWLIST;
  if (configured === undefined) return env.CP_DEV_GMAIL_ONLY !== "1";
  if (typeof recipient !== "string") return false;
  const addresses = configured.split(",").map(value => value.trim().toLowerCase());
  const valid = /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/;
  if (!addresses.length || addresses.some(value => !valid.test(value))) return false;
  return addresses.includes(recipient.trim().toLowerCase());
}
