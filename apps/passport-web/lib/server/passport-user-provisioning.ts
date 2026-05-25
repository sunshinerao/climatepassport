import { randomBytes } from "crypto";
import type { Prisma, UserRole, UserStatus } from "@prisma/client";
import {
  generateClimatePassportId,
  hashUserPassword,
  normalizeUserEmail,
} from "@/lib/server/auth";

type EnsurePassportUserByEmailInput = {
  email: string;
  fallbackName?: string | null;
  phone?: string | null;
  country?: string | null;
  role?: UserRole;
  status?: UserStatus;
};

type PassportUserSelection = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  climatePassportId: string | null;
};

export type EnsuredPassportUser = PassportUserSelection & {
  created: boolean;
  normalizedEmail: string;
};

function resolveFallbackName(input: { fallbackName?: string | null; normalizedEmail: string }) {
  const trimmedName = input.fallbackName?.trim();
  if (trimmedName) {
    return trimmedName;
  }

  const [localPart] = input.normalizedEmail.split("@");
  return localPart || "Climate Passport User";
}

export async function ensurePassportUserByEmail(
  tx: Prisma.TransactionClient,
  input: EnsurePassportUserByEmailInput,
): Promise<EnsuredPassportUser> {
  const normalizedEmail = normalizeUserEmail(input.email);
  const fallbackName = resolveFallbackName({ fallbackName: input.fallbackName, normalizedEmail });

  let user = await tx.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      climatePassportId: true,
    },
  });

  if (!user) {
    const [passwordHash, climatePassportId] = await Promise.all([
      hashUserPassword(randomBytes(24).toString("hex")),
      generateClimatePassportId(),
    ]);

    user = await tx.user.create({
      data: {
        name: fallbackName,
        email: normalizedEmail,
        password: passwordHash,
        role: input.role ?? "ATTENDEE",
        status: input.status ?? "PENDING",
        climatePassportId,
        phone: input.phone?.trim() || null,
        country: input.country?.trim() || null,
        notificationPreference: {
          create: {
            emailEnabled: true,
            inAppEnabled: true,
            smsEnabled: false,
          },
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        climatePassportId: true,
      },
    });

    return {
      ...user,
      created: true,
      normalizedEmail,
    };
  }

  if (!user.climatePassportId) {
    const climatePassportId = await generateClimatePassportId();
    user = await tx.user.update({
      where: { id: user.id },
      data: { climatePassportId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        climatePassportId: true,
      },
    });
  }

  return {
    ...user,
    created: false,
    normalizedEmail,
  };
}