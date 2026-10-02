import { isMailRecipientAllowed } from "./mail-recipient-policy";
export type SendMailOptions = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type MailAcceptance = {
  provider: "resend" | "zoho" | "test-outbox";
  status: "accepted";
  /** Provider correlation IDs; neither is an SMTP Message-ID or proof of delivery. */
  providerRequestId?: string;
  providerMessageId?: string;
};

type MailDependencies = {
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

type MailErrorCode = "MAIL_CONFIG_INVALID" | "MAIL_RECIPIENT_NOT_ALLOWED" | "MAIL_PAYLOAD_INVALID" | "MAIL_TIMEOUT" |
  "MAIL_TRANSPORT_FAILED" | "MAIL_HTTP_REJECTED" | "MAIL_PROVIDER_REJECTED" | "MAIL_RESPONSE_INVALID";

/** Only fixed diagnostic codes escape this module: never provider bodies, URLs, keys or recipients. */
export class MailTransportError extends Error {
  readonly code: MailErrorCode;
  readonly outcome: "not-attempted" | "rejected" | "unknown";
  constructor(code: MailErrorCode, outcome?: "not-attempted" | "rejected" | "unknown") {
    super(code);
    this.name = "MailTransportError";
    this.code = code;
    this.outcome = outcome ?? (code === "MAIL_CONFIG_INVALID" || code === "MAIL_RECIPIENT_NOT_ALLOWED" || code === "MAIL_PAYLOAD_INVALID" ? "not-attempted" : code === "MAIL_PROVIDER_REJECTED" ? "rejected" : "unknown");
  }
}

const fail = (code: MailErrorCode, outcome?: "not-attempted" | "rejected" | "unknown"): never => { throw new MailTransportError(code, outcome); };
const addressPattern = /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/;
const nonempty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const identifier = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_.:-]{1,256}$/.test(value);
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function sender(value: string | undefined) {
  if (!nonempty(value) || /[\r\n]/.test(value)) return fail("MAIL_CONFIG_INVALID");
  const match = /^(.*?)\s*<([^<>]+)>$/.exec(value.trim());
  const address = (match ? match[2] : value).trim();
  const name = match?.[1].trim();
  if (!addressPattern.test(address) || (name && /[<>]/.test(name))) return fail("MAIL_CONFIG_INVALID");
  return { address, ...(name ? { name } : {}) };
}

function zohoEndpoint(value: string | undefined): string {
  if (!nonempty(value)) return fail("MAIL_CONFIG_INVALID");
  let url: URL;
  try { url = new URL(value); } catch { return fail("MAIL_CONFIG_INVALID"); }
  // The operator must copy the endpoint for their own account's data center.
  // Only this hostname is currently verified by the official CPaaS Send Email reference.
  // Other data centers require a reviewed documentation-backed addition, never a guessed fallback.
  const verifiedHosts = new Set(["cpaas.zoho.com"]);
  // No default or region inference. Reject credential-bearing URLs and redirects.
  if (!verifiedHosts.has(url.hostname) || url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      url.port || url.pathname !== "/v1.1/email") return fail("MAIL_CONFIG_INVALID");
  return url.href;
}

/** One attempt only. A timeout has unknown delivery outcome: do not automatically retry or switch provider. */
export async function sendTransactionalMail(
  options: SendMailOptions,
  dependencies: MailDependencies = {},
): Promise<MailAcceptance> {
  const env = dependencies.env ?? process.env;
  if (!isMailRecipientAllowed(options?.to, env)) return fail("MAIL_RECIPIENT_NOT_ALLOWED");
  // Preserve the local isolated-test mailbox; it never contacts a provider.
  if (env.CP_TEST_ENV_ID === "climate-passport-isolated-test" && env.MAIL_TRANSPORT === "test-outbox") {
    if (env.NODE_ENV === "production" || !env.MAIL_TEST_OUTBOX_PATH) return fail("MAIL_CONFIG_INVALID");
    const { appendFile, mkdir } = await import("node:fs/promises");
    const { resolve, dirname } = await import("node:path");
    const outboxPath = resolve(env.MAIL_TEST_OUTBOX_PATH);
    await mkdir(dirname(outboxPath), { recursive: true });
    await appendFile(outboxPath, `${JSON.stringify({ sentAt: new Date().toISOString(), ...options })}\n`, { encoding: "utf8", mode: 0o600 });
    return { provider: "test-outbox", status: "accepted" };
  }

  const provider = env.MAIL_PROVIDER ?? "resend";
  if (provider !== "resend" && provider !== "zoho") return fail("MAIL_CONFIG_INVALID");
  const from = sender(env.MAIL_FROM);
  const apiKey = provider === "zoho" ? env.ZOHO_MAIL_TOKEN : env.RESEND_API_KEY;
  if (!nonempty(apiKey) || /\s/.test(apiKey)) return fail("MAIL_CONFIG_INVALID");
  const url = provider === "zoho" ? zohoEndpoint(env.ZOHO_MAIL_ENDPOINT) : "https://api.resend.com/emails";
  const timeoutMs = dependencies.timeoutMs ?? 10_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) return fail("MAIL_CONFIG_INVALID");
  if (!options || typeof options.to !== "string" || !addressPattern.test(options.to) ||
      !nonempty(options.subject) || /[\r\n]/.test(options.subject) ||
      !nonempty(options.html) || !nonempty(options.text)) return fail("MAIL_PAYLOAD_INVALID");

  const body = provider === "zoho" ? {
    from, to: [{ email_address: { address: options.to } }],
    subject: options.subject, htmlbody: options.html, textbody: options.text,
    track_opens: false, track_clicks: false,
  } : {
    from: from.name ? `${from.name} <${from.address}>` : from.address,
    to: [options.to], subject: options.subject, html: options.html, text: options.text,
  };
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new MailTransportError("MAIL_TIMEOUT"));
      controller.abort();
    }, timeoutMs);
  });
  const send = async (): Promise<MailAcceptance> => {
    let response: Response;
    try {
      response = await (dependencies.fetch ?? fetch)(url, {
        method: "POST", redirect: "error", signal: controller.signal,
        headers: {
          Authorization: provider === "zoho" ? `Zoho-enczapikey ${apiKey}` : `Bearer ${apiKey}`,
          "Content-Type": "application/json", Accept: "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      const guard = error as { name?: string; code?: string; outcome?: string };
      if (env.CP_DEV_GMAIL_ONLY === "1" && guard.name === "DevMailPreSendError" && guard.outcome === "not-attempted" &&
          typeof guard.code === "string" && /^DEV_MAIL_GUARD_(BLOCKED|BUSY|BUDGET_EXHAUSTED|LOW_FREQUENCY_REQUIRED|LEDGER_INVALID|DELIVERY_REQUIRES_REVIEW)$/.test(guard.code)) return fail("MAIL_TRANSPORT_FAILED", "not-attempted");
      return fail(controller.signal.aborted ? "MAIL_TIMEOUT" : "MAIL_TRANSPORT_FAILED");
    }
    if (!response.ok) return fail("MAIL_HTTP_REJECTED", response.status >= 400 && response.status < 500 && response.status !== 408 ? "rejected" : "unknown");
    let result: unknown;
    try { result = await response.json(); } catch { return fail("MAIL_RESPONSE_INVALID"); }
    if (!object(result)) return fail("MAIL_RESPONSE_INVALID");
    if (result.error || result.error_code || (result.message && result.message !== "OK")) {
      const successAlsoPresent = identifier(result.id) || (Array.isArray(result.data) && result.data.some(item => object(item) && item.code === "EM_104"));
      return fail("MAIL_PROVIDER_REJECTED", successAlsoPresent ? "unknown" : "rejected");
    }
    if (provider === "zoho") {
      if (!Array.isArray(result.data) || result.data.length !== 1 || !object(result.data[0])) {
        return fail("MAIL_RESPONSE_INVALID");
      }
      const item = result.data[0];
      if (item.code !== "EM_104" || (item.message !== "OK" && item.message !== "Email request received") || item.error || item.error_code) {
        return fail("MAIL_PROVIDER_REJECTED", nonempty(item.code) && item.code !== "EM_104" ? "rejected" : "unknown");
      }
      if (result.message !== "OK") return fail("MAIL_RESPONSE_INVALID");
      if (!identifier(result.request_id)) return fail("MAIL_RESPONSE_INVALID");
      return { provider, status: "accepted", providerRequestId: result.request_id };
    }
    if (!identifier(result.id)) return fail("MAIL_RESPONSE_INVALID");
    return { provider, status: "accepted", providerMessageId: result.id };
  };
  try { return await Promise.race([send(), timeout]); }
  catch (error) {
    if (env.CP_DEV_GMAIL_ONLY === "1" && (error as { outcome?: string }).outcome !== "not-attempted") {
      const hooks = (globalThis as typeof globalThis & { __cpDevelopmentAuthMail?: { halt(): void } }).__cpDevelopmentAuthMail;
      try { hooks?.halt(); } catch { /* Transport outcome remains uncertain; never retry this request. */ }
    }
    throw error;
  }
  finally { if (timer !== undefined) clearTimeout(timer); }
}
