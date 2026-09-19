import type { ActivityApplication, Activity, PortfolioShareLink, User } from "@prisma/client";
import { getPrismaClient } from "@/lib/server/prisma";

export const PROJECT_APPLICATION_CONSENT_POLICY_VERSION = "PROJECT_APPLICATION_CONSENT_V1";

export type ProjectConsentInput = {
  policyVersion: string;
  shareName: boolean;
  shareEmail: boolean;
  shareTitle: boolean;
  shareBio: boolean;
  shareAffiliations: boolean;
  sharePortfolioLink: boolean;
  portfolioShareLinkId?: string | null;
  purposeSnapshot?: string | null;
};

export type MinimalUser = {
  id: string;
  role: string;
};

/**
 * Owner/admin authorization for PROJECT application reviews.
 * - ADMIN: global access.
 * - Exact organizerUserId match: owner access.
 * - EVENT_MANAGER: otherwise default deny.
 */
export async function canReviewProjectApplication(
  user: MinimalUser,
  activity: Pick<Activity, "organizerUserId"> | null,
): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  if (!activity) return false;
  if (activity.organizerUserId && activity.organizerUserId === user.id) return true;
  return false;
}

export function isValidProjectConsentInput(input: unknown): input is ProjectConsentInput {
  if (!input || typeof input !== "object") return false;
  const c = input as Record<string, unknown>;
  if (c.policyVersion !== PROJECT_APPLICATION_CONSENT_POLICY_VERSION) return false;
  const boolKeys = ["shareName", "shareEmail", "shareTitle", "shareBio", "shareAffiliations", "sharePortfolioLink"] as const;
  for (const key of boolKeys) {
    if (typeof c[key] !== "boolean") return false;
  }
  if (c.portfolioShareLinkId !== undefined && c.portfolioShareLinkId !== null && typeof c.portfolioShareLinkId !== "string") {
    return false;
  }
  if (c.purposeSnapshot !== undefined && c.purposeSnapshot !== null && typeof c.purposeSnapshot !== "string") {
    return false;
  }
  return true;
}

export function allowedProjectReviewStatuses(): string[] {
  // INTERVIEW/OFFERED are recruitment semantics and are never allowed for PROJECT.
  return ["APPROVED", "REJECTED", "WAITLISTED"];
}

/**
 * Verifies that the referenced portfolio share link belongs to the applicant,
 * is active, and has not expired. Returns null if no link is referenced.
 */
export async function validateProjectPortfolioShareLink(
  userId: string,
  linkId: string | null | undefined,
): Promise<Pick<PortfolioShareLink, "id" | "status" | "expiresAt" | "userId"> | null> {
  if (!linkId) return null;
  const prisma = getPrismaClient();
  if (!prisma) throw new Error("Database unavailable.");
  const link = await prisma.portfolioShareLink.findUnique({
    where: { id: linkId },
    select: { id: true, status: true, expiresAt: true, userId: true },
  });
  if (!link) throw new Error("Portfolio share link not found.");
  if (link.userId !== userId) throw new Error("Portfolio share link does not belong to applicant.");
  if (link.status !== "ACTIVE") throw new Error("Portfolio share link is not active.");
  if (link.expiresAt <= new Date()) throw new Error("Portfolio share link has expired.");
  return link;
}

export type ProjectApplicantDisclosure = {
  name?: string | null;
  email?: string | null;
  title?: string | null;
  bio?: string | null;
  affiliations?: string[];
  portfolioLinkId?: string | null;
};

/**
 * Builds a role-safe disclosure object for owner/admin review.
 * Only fields explicitly consented to are included. Raw portfolio tokens are never exposed.
 */
export async function buildProjectApplicantDisclosure(
  applicant: Pick<User, "id" | "name" | "email" | "title" | "bio">,
  consent: ProjectConsentInput | null,
): Promise<ProjectApplicantDisclosure> {
  const prisma = getPrismaClient();
  const disclosure: ProjectApplicantDisclosure = {};
  if (!consent) return disclosure;

  if (consent.shareName) disclosure.name = applicant.name;
  if (consent.shareEmail) disclosure.email = applicant.email;
  if (consent.shareTitle) disclosure.title = applicant.title;
  if (consent.shareBio) disclosure.bio = applicant.bio;

  if (consent.shareAffiliations && prisma) {
    const affiliations = await prisma.personAffiliation.findMany({
      where: {
        person: { userId: applicant.id },
        status: "ACTIVE",
      },
      select: { organizationName: true, institution: { select: { name: true } } },
      orderBy: { order: "asc" },
      take: 10,
    });
    disclosure.affiliations = affiliations
      .map((a) => a.organizationName ?? a.institution?.name ?? null)
      .filter((v): v is string => Boolean(v));
  }

  if (consent.sharePortfolioLink && consent.portfolioShareLinkId) {
    // Expose only the link id; raw token is never disclosed.
    disclosure.portfolioLinkId = consent.portfolioShareLinkId;
  }

  return disclosure;
}

export function buildProjectApplicationActionUrl(source: "submit" | "withdraw" | "review" | "view", activityId: string, locale: "en" | "zh"): string {
  const prefix = locale === "zh" ? "/zh" : "/en";
  switch (source) {
    case "submit":
    case "withdraw":
      return `${prefix}/activities/${activityId}`;
    case "review":
    case "view":
      return `${prefix}/admin/activities/${activityId}/applications`;
    default:
      return `${prefix}/activities/${activityId}`;
  }
}
