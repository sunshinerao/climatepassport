import { createHash } from "node:crypto";
import type { UserRole } from "@prisma/client";
import { maskPassportId } from "@climate-passport/passport-core";
import { writeCoreAuditLog } from "@/lib/server/audit";
import { parseCertificateRenderSnapshot, snapshotText } from "@/lib/server/certificate-snapshot";
import { getPrismaClient } from "@/lib/server/prisma";
import { canManageActivity } from "@/lib/server/verifier-activity";

export type CertificateVerificationChannel = "PUBLIC_API" | "PUBLIC_PAGE" | "SHCW_PUBLIC_API";
export type CertificateVerificationQuerySource = "WEB_QUERY" | "QR_SCAN" | "UNKNOWN";
export type CertificateVerificationAccessLevel = "PUBLIC" | "HOLDER" | "STAFF";
export type CertificateVerificationResult = "PREVIEW" | "NOT_FOUND" | "VALID" | "REVOKED" | "EXPIRED" | "INVALID";

type VerificationRequester = {
  userId?: string | null;
  role?: UserRole | null;
};

type VerificationAuditContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

type CertificateVariableValues = Record<string, unknown>;

export type ResolvePublicCertificateVerificationInput = {
  code: string;
  isPreviewRequest?: boolean;
  channel: CertificateVerificationChannel;
  querySource?: CertificateVerificationQuerySource;
  requester?: VerificationRequester;
  auditContext?: VerificationAuditContext;
};

export type ResolvePublicCertificateVerificationOutput = {
  httpStatus: number;
  valid: boolean;
  result: CertificateVerificationResult;
  verificationCode: string;
  accessLevel: CertificateVerificationAccessLevel;
  message?: string;
  certificate?: {
    title: string;
    titleEn: string | null;
    holderName: string;
    maskedPassportId: string | null;
    issuingOrganization: string;
    issuedAt: string | null;
    expiryDate: string | null;
    credentialType: string;
    credentialTypeEn: string | null;
    relatedSource: string | null;
    certificateNumber: string | null;
    fileName: string | null;
    verifiedAt: string;
    competencies: string[];
    viewer: {
      accessLevel: CertificateVerificationAccessLevel;
      isAuthenticated: boolean;
      canViewExtendedFields: boolean;
    };
    extended?: {
      issueId: string;
      status: string;
      verificationMode: string;
      categoryPublicVerifyEnabled: boolean;
      publicVisible: boolean;
      sourceType: string | null;
      sourceId: string | null;
      holderEmail: string | null;
      verificationCount: number;
      queryCount: number;
    };
  };
};

function normalizeVerificationCode(input: string) {
  return input.trim().toUpperCase();
}

function verificationCodeFingerprint(code: string) {
  return `fp:${createHash("sha256").update(code, "utf8").digest("hex").slice(0, 16)}`;
}

const ACTIVITY_CHECKIN_SOURCE_ID_PREFIX = "activity-checkin-issuance:";
const CERTIFICATE_BATCH_ITEM_SOURCE_ID_PREFIX = "certificate-batch-item:";

async function resolveSourceActivityId(
  prisma: NonNullable<ReturnType<typeof getPrismaClient>>,
  issue: { sourceType: string | null; sourceId: string | null },
): Promise<string | null> {
  if (issue.sourceType === "ACTIVITY_CHECKIN" && issue.sourceId?.startsWith(ACTIVITY_CHECKIN_SOURCE_ID_PREFIX)) {
    const issuanceId = issue.sourceId.slice(ACTIVITY_CHECKIN_SOURCE_ID_PREFIX.length);
    const issuance = await prisma.activityCertificateIssuance.findUnique({
      where: { id: issuanceId },
      select: { activityId: true },
    });
    return issuance?.activityId ?? null;
  }

  if (issue.sourceType === "CERTIFICATE_BATCH" && issue.sourceId?.startsWith(CERTIFICATE_BATCH_ITEM_SOURCE_ID_PREFIX)) {
    const itemId = issue.sourceId.slice(CERTIFICATE_BATCH_ITEM_SOURCE_ID_PREFIX.length);
    const item = await prisma.certificateBatchItem.findUnique({
      where: { id: itemId },
      select: { batch: { select: { activityId: true } } },
    });
    return item?.batch.activityId ?? null;
  }

  return null;
}

async function resolveAccessLevel(
  prisma: NonNullable<ReturnType<typeof getPrismaClient>>,
  input: {
    requesterUserId?: string | null;
    requesterRole?: UserRole | null;
    issue: { userId: string; sourceType: string | null; sourceId: string | null };
  },
): Promise<CertificateVerificationAccessLevel> {
  if (input.requesterUserId && input.requesterUserId === input.issue.userId) {
    return "HOLDER";
  }

  // Role names alone never grant extended access on this endpoint (CP-FR-051):
  // ADMIN technical ops has no routine body browsing here, and VERIFIER/STAFF/
  // SPECIAL_PASS_MANAGER only receive the public whitelist fields. Only an
  // EVENT_MANAGER whose managed activity is the certificate source qualifies.
  if (input.requesterRole === "EVENT_MANAGER" && input.requesterUserId) {
    const activityId = await resolveSourceActivityId(prisma, input.issue);
    if (activityId && await canManageActivity(prisma, { id: input.requesterUserId, role: input.requesterRole }, activityId)) {
      return "STAFF";
    }
  }

  return "PUBLIC";
}

function canPubliclyVerify(issue: {
  definition: {
    verificationMode: string;
    category: {
      publicVerifyEnabled: boolean;
    };
  };
}) {
  if (issue.definition.verificationMode === "INTERNAL_ONLY") {
    return false;
  }

  if (!issue.definition.category.publicVerifyEnabled) {
    return false;
  }

  return true;
}

function asVariableValues(input: unknown): CertificateVariableValues | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  return input as CertificateVariableValues;
}

function pickText(record: CertificateVariableValues | null, ...keys: string[]) {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }

  return null;
}

function parseExpiryDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const date = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T23:59:59.999Z`)
    : new Date(trimmed);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export function getCertificateExpiryDate(variableValuesJson: unknown) {
  const variableValues = asVariableValues(variableValuesJson);

  return parseExpiryDate(
    variableValues?.expiryDate
      ?? variableValues?.expirationDate
      ?? variableValues?.validUntil
      ?? variableValues?.expiresAt
      ?? null,
  );
}

function humanizeSourceType(sourceType: string | null | undefined) {
  if (!sourceType) {
    return null;
  }

  return sourceType
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function getCertificateRelatedSource(variableValuesJson: unknown, sourceType?: string | null) {
  const variableValues = asVariableValues(variableValuesJson);

  return pickText(
    variableValues,
    "programNameEn",
    "programName",
    "projectNameEn",
    "projectName",
    "courseNameEn",
    "courseName",
    "eventNameEn",
    "eventName",
    "cohortNameEn",
    "cohortName",
    "roleNameEn",
    "roleName",
    "locationNameEn",
    "locationName",
  ) ?? humanizeSourceType(sourceType);
}

export function getCertificateIssuingOrganization(variableValuesJson: unknown, fallback = "Climate Passport") {
  const variableValues = asVariableValues(variableValuesJson);

  return pickText(
    variableValues,
    "issuerName",
    "organizationNameEn",
    "organizationName",
    "institutionNameEn",
    "institutionName",
  ) ?? fallback;
}

export function getCertificateCompetencies(variableValuesJson: unknown) {
  const variableValues = asVariableValues(variableValuesJson);
  const rawValue = variableValues?.capabilityTags;

  if (Array.isArray(rawValue)) {
    return rawValue
      .map((entry) => (typeof entry === "string" ? entry.trim() : String(entry ?? "").trim()))
      .filter(Boolean);
  }

  if (typeof rawValue === "string") {
    return rawValue.split(",").map((entry) => entry.trim()).filter(Boolean);
  }

  return [];
}

export function getIssueVerificationResult(
  status: string,
  expiryDate: string | null,
  now = new Date(),
): "VALID" | "REVOKED" | "EXPIRED" | "INVALID" {
  if (status === "REVOKED") {
    return "REVOKED";
  }

  if (expiryDate) {
    const expiresAt = new Date(expiryDate);
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt <= now) {
      return "EXPIRED";
    }
  }

  if (status === "ISSUED") {
    return "VALID";
  }

  return "INVALID";
}

export async function resolvePublicCertificateVerification(
  input: ResolvePublicCertificateVerificationInput,
): Promise<ResolvePublicCertificateVerificationOutput> {
  const prisma = getPrismaClient();

  if (!prisma) {
    return {
      httpStatus: 503,
      valid: false,
      result: "INVALID",
      verificationCode: normalizeVerificationCode(input.code),
      accessLevel: "PUBLIC",
      message: "Database unavailable.",
    };
  }

  const code = normalizeVerificationCode(input.code);
  const isPreviewRequest = input.isPreviewRequest ?? code === "CV-PREVIEW";
  const requesterRole = input.requester?.role ?? null;
  const requesterUserId = input.requester?.userId ?? null;
  const querySource = input.querySource ?? "UNKNOWN";

  if (isPreviewRequest) {
    await writeCoreAuditLog({
      actorUserId: requesterUserId,
      action: "certificate.verify.query",
      subjectType: "certificate_verification_code",
      subjectId: verificationCodeFingerprint(code),
      result: "preview",
      ipAddress: input.auditContext?.ipAddress ?? null,
      userAgent: input.auditContext?.userAgent ?? null,
      metadataJson: {
        channel: input.channel,
        querySource,
        isAuthenticated: Boolean(requesterUserId),
        requesterRole,
      },
    });

    return {
      httpStatus: 200,
      valid: false,
      result: "PREVIEW",
      verificationCode: code,
      accessLevel: "PUBLIC",
      message: "This QR code is from a certificate preview and is not an officially issued credential.",
    };
  }

  const issue = await prisma.certificateIssue.findUnique({
    where: { verificationCode: code },
    include: {
      user: { select: { id: true, name: true, email: true, climatePassportId: true } },
      definition: {
        select: {
          name: true,
          nameEn: true,
          verificationMode: true,
          category: {
            select: {
              name: true,
              nameEn: true,
              publicVerifyEnabled: true,
            },
          },
        },
      },
      verifications: { select: { id: true } },
    },
  });

  if (!issue) {
    await writeCoreAuditLog({
      actorUserId: requesterUserId,
      action: "certificate.verify.query",
      subjectType: "certificate_verification_code",
      subjectId: verificationCodeFingerprint(code),
      result: "not_found",
      ipAddress: input.auditContext?.ipAddress ?? null,
      userAgent: input.auditContext?.userAgent ?? null,
      metadataJson: {
        channel: input.channel,
        querySource,
        isAuthenticated: Boolean(requesterUserId),
        requesterRole,
      },
    });

    return {
      httpStatus: 404,
      valid: false,
      result: "NOT_FOUND",
      verificationCode: code,
      accessLevel: "PUBLIC",
    };
  }

  const accessLevel = await resolveAccessLevel(prisma, {
    requesterUserId,
    requesterRole,
    issue,
  });
  const renderSnapshot = parseCertificateRenderSnapshot(issue.renderSnapshotJson);
  const issuedVariableValues = renderSnapshot?.variableValues ?? issue.variableValuesJson;
  const publicAllowed = canPubliclyVerify(issue);
  const canView = publicAllowed || accessLevel !== "PUBLIC";
  const expiryDate = getCertificateExpiryDate(issuedVariableValues);
  const relatedSource = getCertificateRelatedSource(issuedVariableValues, issue.sourceType);
  const competencies = getCertificateCompetencies(issuedVariableValues);
  const result = canView ? getIssueVerificationResult(issue.status, expiryDate) : "INVALID";
  const valid = result === "VALID";

  const queryCountPromise = accessLevel === "PUBLIC"
    ? Promise.resolve(0)
    : prisma.coreAuditLog.count({
        where: {
          action: "certificate.verify.query",
          subjectType: "certificate_issue",
          subjectId: issue.id,
        },
      });

  const verificationRecordResult = result === "REVOKED"
    ? "REVOKED"
    : result === "VALID"
      ? "VALID"
      : "INVALID";

  await prisma.certificateVerification.create({
    data: {
      certificateIssueId: issue.id,
      verificationChannel: input.channel,
      result: verificationRecordResult,
      verifiedBy: requesterUserId,
      metadataJson: {
        accessLevel,
        querySource,
        publicAllowed,
        requesterRole,
      },
    },
  });

  await writeCoreAuditLog({
    actorUserId: requesterUserId,
    action: "certificate.verify.query",
    subjectType: "certificate_issue",
    subjectId: issue.id,
    result: result.toLowerCase(),
    ipAddress: input.auditContext?.ipAddress ?? null,
    userAgent: input.auditContext?.userAgent ?? null,
    metadataJson: {
      channel: input.channel,
      querySource,
      accessLevel,
      publicAllowed,
      requesterRole,
    },
  });

  const queryCount = await queryCountPromise;
  const verifiedAt = new Date().toISOString();

  const certificate = canView
    ? {
        title: renderSnapshot?.certificateName ?? issue.definition.name,
        titleEn: renderSnapshot
          ? snapshotText(renderSnapshot, "certificateNameEn")
          : issue.definition.nameEn,
        holderName: renderSnapshot?.holderName ?? issue.user.name,
        maskedPassportId: maskPassportId(issue.user.climatePassportId),
        issuingOrganization: getCertificateIssuingOrganization(issuedVariableValues),
        issuedAt: issue.issuedAt?.toISOString() ?? null,
        expiryDate,
        credentialType: renderSnapshot?.categoryName ?? issue.definition.category.name,
        credentialTypeEn: renderSnapshot
          ? snapshotText(renderSnapshot, "categoryNameEn")
          : issue.definition.category.nameEn,
        relatedSource,
        certificateNumber: issue.verificationCode,
        fileName: issue.generatedFileName,
        verifiedAt,
        competencies,
        viewer: {
          accessLevel,
          isAuthenticated: Boolean(requesterUserId),
          canViewExtendedFields: accessLevel !== "PUBLIC",
        },
        extended: accessLevel === "PUBLIC"
          ? undefined
          : {
              issueId: issue.id,
              status: issue.status,
              verificationMode: issue.definition.verificationMode,
              categoryPublicVerifyEnabled: issue.definition.category.publicVerifyEnabled,
              publicVisible: issue.publicVisible,
              sourceType: issue.sourceType,
              sourceId: issue.sourceId,
              holderEmail: issue.user.email,
              verificationCount: issue.verifications.length + 1,
              queryCount,
            },
      }
    : undefined;

  return {
    httpStatus: 200,
    valid,
    result,
    verificationCode: code,
    accessLevel,
    message: !canView
      ? "This credential is not available for public verification."
      : undefined,
    certificate,
  };
}
