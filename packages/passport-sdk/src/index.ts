import { sanitizeChannelBridgeTargetPath } from "@climate-passport/passport-core";
import {
  ApiErrorSchema,
  BridgeExchangeRequestSchema,
  BridgeExchangeResponseSchema,
  BridgeIssueRequestSchema,
  BridgeIssueResponseSchema,
  PublicCertificateVerificationResponseSchema,
  OpenApiSourceRefRequestSchema,
  SourceRefResolveResponseSchema,
  type BridgeExchangeResponse as V1BridgeExchangeResponse,
  type BridgeIssueResponse as V1BridgeIssueResponse,
  type PublicCertificateVerificationResponse,
  type SourceRefResolveResponse,
} from "@climate-passport/passport-contracts";

export type ChannelMachineCredentials = {
  clientKey: string;
  machineKey: string;
};

/** CP-TODO-243: machine-client auth headers for registered channel clients. Never log or persist the machine key. */
export function channelMachineAuthHeaders(credentials: ChannelMachineCredentials): Record<string, string> {
  return {
    "X-Channel-Client-Key": credentials.clientKey,
    "X-Channel-Machine-Key": credentials.machineKey,
  };
}

/**
 * Open API bearer credential: the same registered key as the dual-header form, presented
 * as `<clientKey>.<machineKey>`. Storage is salted bcrypt, so a secret cannot be looked up
 * by digest — the key has to identify its own client.
 */
export function openApiAuthHeaders(credentials: ChannelMachineCredentials): Record<string, string> {
  return { Authorization: `Bearer ${credentials.clientKey}.${credentials.machineKey}` };
}

export type PassportSdkOptions = {
  baseUrl: string;
  fetcher?: typeof fetch;
  channelTargetPrefixes?: string[];
};

export type BridgeTokenResponse = {
  ok: true;
  bridgeToken: {
    token: string;
    channel: "SHCW";
    expiresAt: string;
    targetPath: string | null;
  };
};

export type BridgeExchangeResponse = {
  ok: true;
  redirectTo: string;
};

function joinUrl(baseUrl: string, path: string) {
  return new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}

export class ClimatePassportClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly channelTargetPrefixes: string[];

  constructor(options: PassportSdkOptions) {
    this.baseUrl = options.baseUrl;
    this.fetcher = options.fetcher ?? fetch;
    this.channelTargetPrefixes = options.channelTargetPrefixes ?? ["/en", "/zh", "/fr", "/de"];
  }

  sanitizeBridgeTargetPath(targetPath: string | null | undefined) {
    return sanitizeChannelBridgeTargetPath(targetPath, this.channelTargetPrefixes);
  }

  async issueBridgeToken(targetPath?: string) {
    const safeTargetPath = this.sanitizeBridgeTargetPath(targetPath);
    const response = await this.fetcher(joinUrl(this.baseUrl, "/api/channel/session/bridge"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        channel: "shcw",
        targetPath: safeTargetPath ?? undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(`Bridge token issue failed with status ${response.status}.`);
    }

    return (await response.json()) as BridgeTokenResponse;
  }

  async exchangeBridgeToken(token: string, locale = "en") {
    const response = await this.fetcher(joinUrl(this.baseUrl, "/api/channel/session/exchange"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token, locale }),
    });

    if (!response.ok) {
      throw new Error(`Bridge token exchange failed with status ${response.status}.`);
    }

    return (await response.json()) as BridgeExchangeResponse;
  }

  async verifyCertificate(code: string) {
    const response = await this.fetcher(joinUrl(this.baseUrl, `/api/certificates/verify/${encodeURIComponent(code)}`), {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Certificate verification failed with status ${response.status}.`);
    }

    return response.json();
  }

  /** Versioned SHCW bridge issue API. This only uses the browser session cookie. */
  async issueV1ChannelBridge(targetPath?: string): Promise<V1BridgeIssueResponse> {
    const payload = BridgeIssueRequestSchema.parse({ channel: "SHCW", targetPath: targetPath === undefined ? undefined : this.sanitizeBridgeTargetPath(targetPath) ?? undefined });
    if (targetPath !== undefined && !payload.targetPath) throw new Error("Invalid bridge target path.");
    const response = await this.fetcher(joinUrl(this.baseUrl, "/api/v1/channel/session/bridge"), {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload),
    });
    return this.parseV1Response(response, BridgeIssueResponseSchema, "Bridge token issue");
  }

  /** Versioned SHCW bridge exchange API. This only uses the browser session cookie. */
  async exchangeV1ChannelBridge(token: string, locale = "en"): Promise<V1BridgeExchangeResponse> {
    const payload = BridgeExchangeRequestSchema.parse({ channel: "SHCW", token, locale });
    const response = await this.fetcher(joinUrl(this.baseUrl, "/api/v1/channel/session/exchange"), {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload),
    });
    return this.parseV1Response(response, BridgeExchangeResponseSchema, "Bridge token exchange");
  }

  /**
   * Versioned public minimum-disclosure verification API; business statuses are returned, not thrown.
   * Pass `machine` credentials only from server-side code registered as a MACHINE channel client.
   */
  async verifyV1ChannelCertificate(code: string, options?: { machine?: ChannelMachineCredentials }): Promise<PublicCertificateVerificationResponse> {
    if (!code.trim()) throw new Error("Certificate code is required.");
    const response = await this.fetcher(joinUrl(this.baseUrl, `/api/v1/channel/certificates/verify/${encodeURIComponent(code)}`), {
      method: "GET",
      credentials: "omit",
      headers: options?.machine ? channelMachineAuthHeaders(options.machine) : undefined,
    });
    let body: unknown;
    try { body = await response.json(); } catch { throw new Error("Certificate verification returned a malformed response."); }
    // NOT_FOUND is intentionally HTTP 404 but remains a normal typed verification result.
    const verification = PublicCertificateVerificationResponseSchema.safeParse(body);
    if (verification.success) return verification.data;
    const error = ApiErrorSchema.safeParse(body);
    if (error.success) throw new Error(`Certificate verification failed: ${error.data.error.code}.`);
    throw new Error(`Certificate verification returned an invalid response${response.ok ? "." : ` (status ${response.status}).`}`);
  }

  private async parseV1Response<T>(response: Response, schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }, operation: string): Promise<T> {
    let body: unknown;
    try { body = await response.json(); } catch { throw new Error(`${operation} returned a malformed response.`); }
    if (!response.ok) {
      const error = ApiErrorSchema.safeParse(body);
      if (error.success) throw new Error(`${operation} failed: ${error.data.error.code}.`);
      throw new Error(`${operation} failed with status ${response.status}.`);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new Error(`${operation} returned an invalid response.`);
    return parsed.data;
  }

  /**
   * CP-TODO-252: resolve a generic sourceRef against the CP schema catalog.
   * Open API endpoint: the calling key *is* the source system, so the request body
   * carries no `system` field and the resolution is scoped to that key's programme.
   */
  async resolveSourceRef(machine: ChannelMachineCredentials, ref: { objectType: string; objectId: string }): Promise<SourceRefResolveResponse> {
    const payload = OpenApiSourceRefRequestSchema.parse(ref);
    const response = await this.fetcher(joinUrl(this.baseUrl, "/api/v1/open/source-refs/resolve"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...openApiAuthHeaders(machine) },
      body: JSON.stringify(payload),
    });
    return this.parseV1Response(response, SourceRefResolveResponseSchema, "Source reference resolution");
  }
}

export function createClimatePassportClient(options: PassportSdkOptions) {
  return new ClimatePassportClient(options);
}
