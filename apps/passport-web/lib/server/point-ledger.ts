import { getPrismaClient } from "@/lib/server/prisma";

type PointLedgerClient = Pick<NonNullable<ReturnType<typeof getPrismaClient>>, "user" | "pointTransaction"> & {
  $transaction?: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T>;
};

export async function grantUserPoints(input: {
  userId: string;
  points: number;
  type: string;
  description: string;
  eventId?: string | null;
  registrationId?: string | null;
  createdBy?: string | null;
  idempotencyKey?: string;
  client?: PointLedgerClient;
}) {
  const points = Number.isFinite(input.points) ? Math.trunc(input.points) : 0;
  if (points <= 0) {
    return { ok: true as const, awarded: false as const, reason: "non_positive_points" as const };
  }

  const runtimeClient = input.client ?? getPrismaClient();
  if (!runtimeClient) {
    throw new Error("Database unavailable.");
  }

  const description = input.idempotencyKey
    ? `[${input.idempotencyKey}] ${input.description}`
    : input.description;

  const writeWithClient = async (client: PointLedgerClient) => {
    if (input.idempotencyKey) {
      const existing = await client.pointTransaction.findFirst({
        where: {
          userId: input.userId,
          type: input.type,
          description,
        },
        select: { id: true },
      });

      if (existing) {
        return { ok: true as const, awarded: false as const, reason: "duplicate_idempotency_key" as const };
      }
    }

    await client.user.update({
      where: { id: input.userId },
      data: { points: { increment: points } },
    });

    await client.pointTransaction.create({
      data: {
        userId: input.userId,
        points,
        type: input.type,
        eventId: input.eventId ?? null,
        registrationId: input.registrationId ?? null,
        description,
        createdBy: input.createdBy ?? null,
      },
    });

    return { ok: true as const, awarded: true as const };
  };

  if (input.client) {
    return writeWithClient(input.client);
  }

  const prismaClient = runtimeClient as NonNullable<ReturnType<typeof getPrismaClient>>;
  return prismaClient.$transaction((tx) => writeWithClient(tx as PointLedgerClient));
}
