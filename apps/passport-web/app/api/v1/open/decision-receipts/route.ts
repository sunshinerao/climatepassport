import {
  DecisionReceiptSubmitSchema,
  OpenApiDecisionReceiptListResponseSchema,
  type OpenApiDecisionReceipt,
} from "@climate-passport/passport-contracts";
import { openApiOptions } from "@/lib/server/open-api-cors";
import { openApiDomainError, openApiInvalidRequest, openApiOk, requireOpenApiKey } from "@/lib/server/open-api-auth";
import { openApiPageMeta, readOpenApiPage } from "@/lib/server/open-api-page";
import { listDecisionReceipts, receiveDecisionReceipt } from "@/lib/server/external-decision-receipts";

export const OPTIONS = openApiOptions;

/**
 * CP-TODO-250 / CP-FR-059：外部决定回执的对外门面（提交 + 回读）。
 *
 * 隔离靠 issuerKey：查询只认认证出来的那把自己提交的回执，body/query 里的 issuer
 * 一律不采信。programmeId 由 key 归属写入，用于管理台按租户统计，不参与可见性判定。
 */

type ReceiptRow = { id: string; receivedAt: Date } & Record<string, unknown>;

function iso(value: unknown): string | null {
  return value instanceof Date ? value.toISOString() : null;
}

/** 对外投影：`minimalJson` 与 `signature` 不外发，提交方本来就有自己的副本。 */
function outwardReceipt(row: ReceiptRow): OpenApiDecisionReceipt {
  return {
    id: row.id,
    issuerKey: String(row.issuerKey),
    programmeId: typeof row.programmeId === "string" ? row.programmeId : null,
    objectType: String(row.objectType),
    objectId: String(row.objectId),
    objectRevision: Number(row.objectRevision),
    purpose: String(row.purpose),
    decision: row.decision as OpenApiDecisionReceipt["decision"],
    contentHash: typeof row.contentHash === "string" ? row.contentHash : null,
    validUntil: iso(row.validUntil),
    status: String(row.status),
    receivedAt: row.receivedAt.toISOString(),
  };
}

export async function POST(request: Request) {
  const gate = await requireOpenApiKey(request, { scope: "channel:decisions:submit" });
  if (!gate.ok) return gate.response;

  const parsed = DecisionReceiptSubmitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return openApiInvalidRequest(gate.requestId, parsed.error.issues[0]?.message ?? "Invalid payload.");
  }

  const result = await receiveDecisionReceipt(gate.prisma, {
    issuerKey: gate.client.key,
    programmeId: gate.client.programmeId,
    objectType: parsed.data.objectType,
    objectId: parsed.data.objectId,
    objectRevision: parsed.data.objectRevision,
    purpose: parsed.data.purpose,
    decision: parsed.data.decision,
    minimalJson: parsed.data.minimalJson,
    signature: parsed.data.signature ?? null,
    idempotencyKey: parsed.data.idempotencyKey,
    validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : null,
  });
  if ("error" in result) return openApiDomainError(gate.requestId, result);

  return openApiOk(gate, { receiptId: result.receiptId, deduplicated: result.deduplicated }, 201);
}

export async function GET(request: Request) {
  const gate = await requireOpenApiKey(request, { scope: "channel:decisions:submit" });
  if (!gate.ok) return gate.response;

  const pageRequest = readOpenApiPage(new URL(request.url).searchParams);
  if ("error" in pageRequest) return openApiDomainError(gate.requestId, pageRequest);

  const searchParams = new URL(request.url).searchParams;
  const { receipts } = await listDecisionReceipts(gate.prisma, {
    objectType: searchParams.get("objectType") ?? undefined,
    objectId: searchParams.get("objectId") ?? undefined,
    purpose: searchParams.get("purpose") ?? undefined,
    issuerKey: gate.client.key,
    cursor: pageRequest.cursor,
    // 多取一条判断是否还有下一页。
    take: pageRequest.limit + 1,
  });
  const { rows, meta } = openApiPageMeta({
    limit: pageRequest.limit,
    rows: receipts as unknown as ReceiptRow[],
    cursorOf: (row) => row.receivedAt,
  });

  return openApiOk(gate, OpenApiDecisionReceiptListResponseSchema.parse({
    ok: true,
    receipts: rows.map(outwardReceipt),
    page: meta,
  }));
}
