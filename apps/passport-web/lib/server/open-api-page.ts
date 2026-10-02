import { OpenApiPageMetaSchema } from "@climate-passport/passport-contracts";

/**
 * Open API 列表端点的游标分页。
 *
 * 不用 offset：对外数据是持续增长的时间序，offset 在翻页途中插入新行会让调用方
 * 重复或漏读，而且大 offset 会退化成全表扫描。这里用 keyset（receivedAt + id），
 * 游标是不透明串——调用方不该依赖它的内部结构，格式将来可变。
 */

export const OPEN_API_DEFAULT_PAGE_SIZE = 50;
export const OPEN_API_MAX_PAGE_SIZE = 200;

export type OpenApiCursor = { receivedAt: Date; id: string };

export type OpenApiPageRequest = { limit: number; cursor: OpenApiCursor | null };

export type OpenApiPageFailure = { error: string; status: number; code: string };

function decodeCursor(value: string): OpenApiCursor | null {
  const decoded = Buffer.from(value, "base64url").toString("utf8");
  const separator = decoded.lastIndexOf(".");
  if (separator <= 0 || separator === decoded.length - 1) return null;
  const receivedAt = new Date(decoded.slice(0, separator));
  const id = decoded.slice(separator + 1);
  if (Number.isNaN(receivedAt.getTime()) || !id || id.length > 64) return null;
  return { receivedAt, id };
}

/** 解析 `limit` / `cursor`；非法输入按 400 拒绝，而不是悄悄回到默认值。 */
export function readOpenApiPage(searchParams: URLSearchParams): OpenApiPageRequest | OpenApiPageFailure {
  const rawLimit = searchParams.get("limit");
  const limit = rawLimit === null ? OPEN_API_DEFAULT_PAGE_SIZE : Number.parseInt(rawLimit, 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > OPEN_API_MAX_PAGE_SIZE) {
    return { error: `limit must be an integer between 1 and ${OPEN_API_MAX_PAGE_SIZE}.`, status: 400, code: "INVALID_REQUEST" };
  }
  const rawCursor = searchParams.get("cursor");
  if (rawCursor === null) return { limit, cursor: null };
  const cursor = decodeCursor(rawCursor);
  if (!cursor) {
    return { error: "cursor is not a value this page returned.", status: 400, code: "INVALID_REQUEST" };
  }
  return { limit, cursor };
}

/** `nextCursor` 为 null 表示已到末页；meta 由契约层再校验一次，防止端点自造分页形态。 */
export function openApiPageMeta<T extends { id: string }>(input: {
  limit: number;
  /** 多取一条用于判断是否还有下一页。 */
  rows: T[];
  cursorOf: (row: T) => Date;
}): { rows: T[]; meta: { limit: number; nextCursor: string | null } } {
  const hasMore = input.rows.length > input.limit;
  const rows = hasMore ? input.rows.slice(0, input.limit) : input.rows;
  const last = rows.at(-1);
  const nextCursor = hasMore && last
    ? Buffer.from(`${input.cursorOf(last).toISOString()}.${last.id}`, "utf8").toString("base64url")
    : null;
  return { rows, meta: OpenApiPageMetaSchema.parse({ limit: input.limit, nextCursor }) };
}
