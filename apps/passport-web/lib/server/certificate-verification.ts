import type { UserRole } from "@prisma/client";
import { maskPassportId } from "@climate-passport/passport-core";
import { writeCoreAuditLog } from "@/lib/server/audit";
import { getPrismaClient } from "@/lib/server/prisma";

export type CertificateVerificationChannel = "PUBLIC_API" | "PUBLIC_PAGE";
export type CertificateVerificationQuerySource = "WEB_QUERY" | "QR_SCAN" | "UNKNOWN";
export type CertificateVerificationAccessLevel = "PUBLIC" | "HOLDER" | "STAFF";
export type CertificateVerificationResult = "PREVIEW" | "NOT_FOUND" | "VALID" | "REVOKED" | "INVALID";

type VerificationRequester = {
  userId?: string | null;
  role?: UserRole | null;
};

type VerificationAuditContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

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
    credentialType: string;
    credentialTypeEn: string | null;
    certificateNumber: string | null;
    fileName: string | null;
    verifiedAt: string;
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

function isPrivilegedRole(role: UserRole | null | undefined) {
  return role === "ADMIN"
    || role === "EVENT_MANAGER"
    || role === "VERIFIER"
    || role === "STAFF"
    || role === "SPECIAL_PASS_MANAGER";
}

function resolveAccessLevel(input: {
  requesterUserId?: string | null;
  requesterRole?: UserRole | null;
  holderUserId: string;
}): CertificateVerificationAccessLevel {
  if (input.requesterUserId && input.requesterUserId === input.holderUserId) {
    return "HOLDER";
  }

  if (isPrivilegedRole(input.requesterRole)) {
    return "STAFF";
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

function getIssueVerificationResult(status: string): "VALID" | "REVOKED" | "INVALID" {
  if (status === "REVOKED") {
    return "REVOKED";
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
      subjectId: code,
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
      subjectId: code,
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

  const accessLevel = resolveAccessLevel({
    requesterUserId,
    requesterRole,
    holderUserId: issue.userId,
  });
  const publicAllowed = canPubliclyVerify(issue);
  const canView = publicAllowed || accessLevel !== "PUBLIC";
  const result = canView ? getIssueVerificationResult(issue.status) : "INVALID";
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

  const verificationRecordResult = result === "REVOKED" ? "REVOKED" : result === "VALID" ? "VALID" : "INVALID";

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
    result: verificationRecordResult.toLowerCase(),
    ipAddress: input.auditContext?.ipAddress ?? null,
    userAgent: input.auditContext?.userAgent ?? null,
    metadataJson: {
      channel: input.channel,
      querySource,
      accessLevel,
      publicAllowed,
      requesterRole,
      verificationCode: code,
    },
  });

  const queryCount = await queryCountPromise;
  const verifiedAt = new Date().toISOString();

  return {
    httpStatus: 200,
    valid,
    result,
    verificationCode: code,
    accessLevel,
    message: !canView
      ? "This credential is not available for public verification."
      : undefined,
    certificate: {
      title: issue.definition.name,
      titleEn: issue.definition.nameEn,
      holderName: issue.user.name,
      maskedPassportId: maskPassportId(issue.user.climatePassportId),
      issuingOrganization: "Climate Passport",
      issuedAt: issue.issuedAt?.toISOString() ?? null,
      credentialType: issue.definition.category.name,
      credentialTypeEn: issue.definition.category.nameEn,
      certificateNumber: issue.verificationCode,
      fileName: issue.generatedFileName,
      verifiedAt,
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
    },
  };
}