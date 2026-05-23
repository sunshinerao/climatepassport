import { sanitizeChannelBridgeTargetPath } from "@climate-passport/passport-core";

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
}

export function createClimatePassportClient(options: PassportSdkOptions) {
  return new ClimatePassportClient(options);
}
