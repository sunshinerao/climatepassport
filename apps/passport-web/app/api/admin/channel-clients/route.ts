import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { ChannelScopeSchema } from "@climate-passport/passport-contracts";
import { getPrismaClient } from "@/lib/server/prisma";
import { MACHINE_KEY_MAX_VALID_DAYS, RATE_LIMIT_BOUNDS, registerChannelClient } from "@/lib/server/channel-client-auth";
import { requireApiRole } from "@/lib/server/api-auth";

const CLIENT_SEARCH_MAX_LENGTH = 120;
const CLIENT_PAGE_SIZE_MAX = 100;
const CLIENT_PAGE_SIZE_DEFAULT = 25;

const listQuerySchema = z.object({
  programmeId: z.string().uuid().optional(),
  type: z.enum(["USER_FACING", "MACHINE"]).optional(),
  search: z.string().trim().max(CLIENT_SEARCH_MAX_LENGTH).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(CLIENT_PAGE_SIZE_MAX).default(CLIENT_PAGE_SIZE_DEFAULT),
});

const registerSchema = z.object({
  key: z.string().trim().min(3).max(63).optional(),
  displayName: z.string().trim().min(2).max(160),
  type: z.enum(["USER_FACING", "MACHINE"]),
  programmeId: z.string().uuid(),
  allowedOrigins: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  allowedIps: z.array(z.string().trim().min(1).max(64)).max(50).default([]),
  allowedScopes: z.array(ChannelScopeSchema).min(1).max(20),
  rateLimitLimit: z.number().int().min(RATE_LIMIT_BOUNDS.minLimit).max(RATE_LIMIT_BOUNDS.maxLimit).optional(),
  rateLimitWindowMs: z.number().int().min(RATE_LIMIT_BOUNDS.minWindowMs).max(RATE_LIMIT_BOUNDS.maxWindowMs).optional(),
  expiresInDays: z.number().int().min(1).max(MACHINE_KEY_MAX_VALID_DAYS).optional(),
  /** 72 字节是 bcrypt 的输入截断边界；超长机密在此拒绝，而不是静默只校验前 72 字节。 */
  machineKey: z.string().trim().min(16).max(72).optional(),
  callbackUrl: z.string().trim().url().max(500).optional(),
});

/** CP-TODO-243：登记渠道客户端（ADMIN）。密钥明文仅在创建响应出现一次。 */
export async function POST(req: NextRequest) {
  const user = await requireApiRole(["ADMIN"], req);
  if (user instanceof NextResponse) return user;
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const parsed = registerSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });

  const result = await registerChannelClient(prisma, { ...parsed.data, actorUserId: user.id });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json(
    {
      client: result.client,
      machineKey: result.machineKey,
      openApiKey: result.openApiKey,
      machineKeyExpiresAt: result.machineKeyExpiresAt,
      warning: result.openApiKey ? "Store this key now; it is never returned again." : undefined,
    },
    { status: 201 },
  );
}

/** 列出已登记客户端（不含任何 secret 材料）。服务端分页：清单可达数千把 key。 */
export async function GET(req: NextRequest) {
  const apiAuth = await requireApiRole(["ADMIN"], req);
  if (apiAuth instanceof NextResponse) return apiAuth;
  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "Database unavailable." }, { status: 503 });

  const parsed = listQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid query." }, { status: 400 });
  }

  const { programmeId, type, search, page, pageSize } = parsed.data;
  const where: Prisma.ChannelClientWhereInput = {};
  if (programmeId) where.programmeId = programmeId;
  if (type) where.type = type;
  if (search) {
    // 空 OR 数组在 Prisma 里匹配不到任何行，所以子句只在有关键词时才挂上。
    where.OR = [
      { displayName: { contains: search, mode: "insensitive" } },
      { key: { contains: search, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.channelClient.findMany({
      where,
      select: {
        id: true, key: true, displayName: true, type: true, programmeId: true,
        allowedOrigins: true, allowedIps: true, allowedScopes: true, isActive: true,
        machineKeyRef: true, machineKeyHash: true,
        rateLimitLimit: true, rateLimitWindowMs: true,
        machineKeyIssuedAt: true, machineKeyExpiresAt: true, machineKeyRotatedAt: true, machineKeyLastUsedAt: true,
        revokedAt: true, revokeReason: true,
        createdAt: true, updatedAt: true,
      },
      // 次级排序键不可省：同一毫秒登记的批量行在翻页时会跨页重复或漏行。
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.channelClient.count({ where }),
  ]);

  // 摘要列只用来推导「是否已配置密钥」，绝不外传；遗留 sha256 行同样算已配置。
  const clients = rows.map(({ machineKeyHash, ...client }) => ({
    ...client,
    machineKeyConfigured: Boolean(machineKeyHash) || client.machineKeyIssuedAt !== null,
    machineKeyAlgorithm: machineKeyHash ? "sha256-legacy" : client.machineKeyIssuedAt ? "bcrypt" : null,
  }));
  return NextResponse.json({
    clients,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}
