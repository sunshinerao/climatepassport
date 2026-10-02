import { NextResponse } from "next/server";
import type { PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@/lib/server/prisma";

/**
 * Open API 的浏览器可达性。
 *
 * 鉴权层已经把「带 Origin 即浏览器调用，且必须命中该 key 的 allowedOrigins」作为硬规则
 * （见 open-api-auth.ts）；没有这里回应的 CORS，那条规则只是把合法浏览器调用挡在
 * 预检阶段，等于宣告 Open API 不支持前端直连。二者配套才有意义。
 *
 * 只回声明过该来源的 key 才有的 CORS 头：`allowedOrigins` 是逐 key 的白名单，
 * 预检没有凭据，因此改为「是否存在一个启用中的 MACHINE 客户端允许这个 origin」，
 * 绝不回 `*`——回 `*` 等于替所有租户声明可达。
 */

const ALLOWED_HEADERS = "authorization, content-type, idempotency-key";
const ALLOWED_METHODS = "GET, POST, PATCH, OPTIONS";
const PREFLIGHT_MAX_AGE_SECONDS = 600;

function normalizedOrigin(value: string | null) {
  const origin = value?.trim().replace(/\/$/, "");
  return origin && origin !== "null" ? origin : null;
}

/** 该 origin 是否被任一启用中的机器客户端显式允许（跨 Programme 的并集，仅用于预检）。 */
export async function isOpenApiOriginAllowlisted(prisma: PrismaClient, origin: string) {
  const client = await prisma.channelClient.findFirst({
    where: { type: "MACHINE", isActive: true, allowedOrigins: { has: origin }, programme: { isActive: true } },
    select: { id: true },
  });
  return client !== null;
}

/** 命中白名单的来源才回显到响应上；服务端调用（无 Origin）不加任何 CORS 头。 */
export function withOpenApiCors(response: NextResponse, origin: string | null) {
  if (!origin) return response;
  response.headers.set("access-control-allow-origin", origin);
  response.headers.set("vary", "Origin");
  // 凭据只走 Authorization 头，绝不带 cookie：带 cookie 会让 Open API 变成会话旁路。
  response.headers.set("access-control-allow-credentials", "false");
  return response;
}

/**
 * 预检处理器。各 open 路由 `export const OPTIONS = openApiOptions` 复用同一份判定，
 * 避免每个端点自己决定允许哪些头。
 */
export async function openApiOptions(request: Request) {
  const origin = normalizedOrigin(request.headers.get("origin"));
  if (!origin) return new NextResponse(null, { status: 405 });
  const prisma = getPrismaClient();
  if (!prisma) return new NextResponse(null, { status: 503 });
  if (!(await isOpenApiOriginAllowlisted(prisma, origin))) {
    // 不回 CORS 头即浏览器判为跨源失败；这里也不透露该来源是否在别的 key 上登记过。
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": ALLOWED_METHODS,
      "access-control-allow-headers": ALLOWED_HEADERS,
      "access-control-expose-headers": "x-request-id, retry-after",
      "access-control-max-age": String(PREFLIGHT_MAX_AGE_SECONDS),
      vary: "Origin",
    },
  });
}

/** 从请求头取出可用于 CORS 回显的 Origin（与鉴权层同一规范化口径）。 */
export function requestOrigin(request: Request) {
  return normalizedOrigin(request.headers.get("origin"));
}
