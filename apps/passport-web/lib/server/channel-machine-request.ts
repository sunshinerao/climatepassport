import { NextRequest, NextResponse } from "next/server";
import { authenticateChannelMachine, MACHINE_AUTH_ERROR_CODES, readCallerIp, readMachineCredentials } from "./channel-client-auth";
import { getPrismaClient } from "./prisma";

type MachineAuthCode = (typeof MACHINE_AUTH_ERROR_CODES)[keyof typeof MACHINE_AUTH_ERROR_CODES];

const MACHINE_AUTH_ERROR_MESSAGES: Record<MachineAuthCode, string> = {
  CHANNEL_MACHINE_AUTH_FAILED: "Channel machine authentication failed.",
  CHANNEL_MACHINE_KEY_EXPIRED: "Channel machine key has expired.",
  CHANNEL_SCOPE_DENIED: "Channel scope denied.",
  CHANNEL_ORIGIN_DENIED: "Channel origin denied.",
  CHANNEL_IP_DENIED: "Channel caller address is not allowlisted.",
};

function machineAuthError(code: MachineAuthCode, status: number) {
  return NextResponse.json({ error: MACHINE_AUTH_ERROR_MESSAGES[code], code }, { status });
}

/**
 * CP-TODO-245：机器客户端请求认证（默认拒绝）。成功返回 prisma 与已认证客户端
 * 身份（clientKey 同时作为来源系统标识，天然隔离跨 Programme 寻址）。
 */
export async function authenticateMachineRequest(req: NextRequest, requiredScope: string) {
  const prisma = getPrismaClient();
  if (!prisma) return { ok: false as const, response: NextResponse.json({ error: "Database unavailable." }, { status: 503 }) };

  const credentials = readMachineCredentials(req.headers);
  if (!credentials) return { ok: false as const, response: machineAuthError("CHANNEL_MACHINE_AUTH_FAILED", 401) };

  let machineAuth: Awaited<ReturnType<typeof authenticateChannelMachine>>;
  try {
    machineAuth = await authenticateChannelMachine(prisma, {
      clientKey: credentials.clientKey,
      machineKey: credentials.machineKey,
      requiredScope,
      origin: req.headers.get("origin"),
      clientIp: readCallerIp(req.headers),
    });
  } catch (error) {
    console.error("channel machine authentication failed:", error);
    return { ok: false as const, response: NextResponse.json({ error: "Authentication unavailable." }, { status: 503 }) };
  }
  if (!machineAuth.ok) {
    return { ok: false as const, response: machineAuthError(MACHINE_AUTH_ERROR_CODES[machineAuth.code], machineAuth.status) };
  }

  return { ok: true as const, prisma, clientKey: machineAuth.client.key, programmeId: machineAuth.client.programmeId };
}
