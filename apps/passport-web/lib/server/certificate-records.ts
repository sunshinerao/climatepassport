import { z } from "zod";

const positiveInteger = (fallback: number, maximum: number) => z.preprocess(
  (value) => typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value,
  z.number().int().min(1).max(maximum).catch(fallback),
);

export const certificateRecordsQuerySchema = z.object({
  page: positiveInteger(1, 100000),
  pageSize: positiveInteger(20, 100),
  search: z.string().trim().max(120).catch(""),
  status: z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "GENERATED", "ISSUED", "REVOKED"]).optional().catch(undefined),
  category: z.string().trim().uuid().optional().catch(undefined),
  issuedFrom: z.string().date().optional().catch(undefined),
  issuedTo: z.string().date().optional().catch(undefined),
});

export type CertificateRecordsQuery = z.infer<typeof certificateRecordsQuerySchema>;

export function parseCertificateRecordsQuery(input: Record<string, string | string[] | undefined>): CertificateRecordsQuery {
  const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const parsed = certificateRecordsQuerySchema.parse({
    page: one(input.page), pageSize: one(input.pageSize), search: one(input.search), status: one(input.status),
    category: one(input.category), issuedFrom: one(input.issuedFrom), issuedTo: one(input.issuedTo),
  });
  if (parsed.issuedFrom && parsed.issuedTo && parsed.issuedFrom > parsed.issuedTo) {
    return { ...parsed, issuedTo: undefined };
  }
  return parsed;
}

export function buildCertificateRecordsWhere(query: CertificateRecordsQuery) {
  const search = query.search || undefined;
  return {
    ...(query.status ? { status: query.status } : {}),
    ...(query.category ? { definition: { categoryId: query.category } } : {}),
    ...(query.issuedFrom || query.issuedTo ? {
      issuedAt: {
        ...(query.issuedFrom ? { gte: new Date(`${query.issuedFrom}T00:00:00.000Z`) } : {}),
        ...(query.issuedTo ? { lte: new Date(`${query.issuedTo}T23:59:59.999Z`) } : {}),
      },
    } : {}),
    ...(search ? {
      OR: [
        { verificationCode: { contains: search, mode: "insensitive" as const } },
        { user: { is: { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { email: { contains: search, mode: "insensitive" as const } }] } } },
      ],
    } : {}),
  };
}

// Aggregates intentionally use the same criteria as the paginated list, including
// status when one is selected, so summary labels always describe filtered results.
export function buildCertificateRecordsAggregateWhere(query: CertificateRecordsQuery) {
  return buildCertificateRecordsWhere(query);
}

export const certificateRecordsOrderBy = [{ issuedAt: "desc" as const }, { createdAt: "desc" as const }, { id: "desc" as const }];
