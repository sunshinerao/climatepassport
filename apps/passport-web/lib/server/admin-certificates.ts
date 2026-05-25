import type { Prisma } from "@prisma/client";
import { z } from "zod";

const optionalTrimmedString = z
  .string()
  .trim()
  .nullish()
  .transform((value) => value || null);

const safeHexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .nullish()
  .transform((value) => value ?? null);

const optionalDataImage = z
  .string()
  .trim()
  .max(2_000_000)
  .regex(/^data:image\/(png|jpe?g|webp);base64,[a-zA-Z0-9+/=]+$/)
  .nullish()
  .transform((value) => value ?? null);

const CERTIFICATE_TEMPLATE_VARIABLE_NAMES = [
  "holderName",
  "holderNameEn",
  "certificateName",
  "certificateNameEn",
  "categoryName",
  "categoryNameEn",
  "workName",
  "workNameEn",
  "eventName",
  "eventNameEn",
  "projectName",
  "projectNameEn",
  "programName",
  "programNameEn",
  "courseName",
  "courseNameEn",
  "roleName",
  "roleNameEn",
  "organizationName",
  "organizationNameEn",
  "institutionName",
  "institutionNameEn",
  "achievementName",
  "achievementNameEn",
  "milestoneName",
  "milestoneNameEn",
  "sessionName",
  "sessionNameEn",
  "topicName",
  "topicNameEn",
  "trackName",
  "trackNameEn",
  "speakerName",
  "speakerNameEn",
  "mentorName",
  "mentorNameEn",
  "cohortName",
  "cohortNameEn",
  "locationName",
  "locationNameEn",
  "completionDate",
  "issueDate",
  "certificateNumber",
  "issuerName",
  "signer",
  "learningHours",
  "capabilityTags",
  "verificationUrl",
] as const;

function isTemplateVariableName(value: unknown): value is typeof CERTIFICATE_TEMPLATE_VARIABLE_NAMES[number] {
  return typeof value === "string" && CERTIFICATE_TEMPLATE_VARIABLE_NAMES.includes(value as typeof CERTIFICATE_TEMPLATE_VARIABLE_NAMES[number]);
}

function sanitizeBoundedNumber(value: unknown, fallback: number, min: number, max: number) {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numericValue));
}

function sanitizeCertificateElement(value: unknown): Prisma.InputJsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const input = value as Record<string, unknown>;
  const kind = input.kind === "TEXT" || input.kind === "VARIABLE" || input.kind === "IMAGE" || input.kind === "QR" || input.kind === "NOTE"
    ? input.kind
    : null;

  if (!kind || typeof input.id !== "string" || !input.id.trim()) {
    return null;
  }

  const variable = isTemplateVariableName(input.variable) ? input.variable : undefined;
  const imageKey = input.imageKey === "logo" || input.imageKey === "signature" || input.imageKey === "seal"
    ? input.imageKey
    : undefined;
  const textAlign = input.textAlign === "center" || input.textAlign === "right" ? input.textAlign : "left";

  return {
    id: input.id.trim().slice(0, 80),
    kind,
    label: typeof input.label === "string" ? input.label.trim().slice(0, 120) : undefined,
    content: typeof input.content === "string" ? input.content.trim().slice(0, 1000) : undefined,
    variable,
    imageKey,
    qrLabelGap: typeof input.qrLabelGap === "number" || typeof input.qrLabelGap === "string"
      ? sanitizeBoundedNumber(input.qrLabelGap, 6, 0, 40)
      : undefined,
    qrLabelOffsetY: typeof input.qrLabelOffsetY === "number" || typeof input.qrLabelOffsetY === "string"
      ? sanitizeBoundedNumber(input.qrLabelOffsetY, 0, -40, 40)
      : undefined,
    qrLabelFontSize: typeof input.qrLabelFontSize === "number" || typeof input.qrLabelFontSize === "string"
      ? sanitizeBoundedNumber(input.qrLabelFontSize, 10, 8, 24)
      : undefined,
    x: sanitizeBoundedNumber(input.x, 0, 0, 100),
    y: sanitizeBoundedNumber(input.y, 0, 0, 100),
    width: sanitizeBoundedNumber(input.width, 20, 1, 100),
    height: sanitizeBoundedNumber(input.height, 8, 1, 100),
    fontFamily: typeof input.fontFamily === "string" ? input.fontFamily.trim().slice(0, 120) : undefined,
    fontSize: typeof input.fontSize === "number" || typeof input.fontSize === "string"
      ? sanitizeBoundedNumber(input.fontSize, 16, 6, 96)
      : undefined,
    fontWeight: typeof input.fontWeight === "string" && /^(400|500|600|700|800)$/.test(input.fontWeight)
      ? input.fontWeight
      : undefined,
    color: typeof input.color === "string" && /^#[0-9a-fA-F]{6}$/.test(input.color)
      ? input.color
      : undefined,
    textAlign,
    lineHeight: typeof input.lineHeight === "number" || typeof input.lineHeight === "string"
      ? sanitizeBoundedNumber(input.lineHeight, 1.35, 0.8, 2.4)
      : undefined,
    zIndex: typeof input.zIndex === "number" || typeof input.zIndex === "string"
      ? Math.round(sanitizeBoundedNumber(input.zIndex, 10, 0, 100))
      : undefined,
    visible: input.visible === false ? false : true,
  };
}

function sanitizeCertificateElements(elements: unknown[] | undefined): Prisma.InputJsonArray | undefined {
  if (!elements || elements.length === 0) {
    return undefined;
  }

  const sanitized = elements
    .map(sanitizeCertificateElement)
    .filter((item): item is Prisma.InputJsonObject => Boolean(item))
    .slice(0, 40);

  return sanitized.length > 0 ? (sanitized as Prisma.InputJsonArray) : undefined;
}

export const certificateCategoryPayloadSchema = z.object({
  id: z.string().uuid().optional(),
  key: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
  name: z.string().trim().min(2).max(120),
  nameEn: optionalTrimmedString,
  description: optionalTrimmedString,
  descriptionEn: optionalTrimmedString,
  order: z.coerce.number().int().min(0).max(9999).nullish(),
  autoIssueEnabled: z.boolean().default(true),
  userRequestEnabled: z.boolean().default(false),
  pdfEnabled: z.boolean().default(true),
  publicVerifyEnabled: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export const certificateTemplatePayloadSchema = z.object({
  id: z.string().uuid().optional(),
  categoryId: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  nameEn: optionalTrimmedString,
  templateType: z.enum(["ATTENDANCE", "LEARNING", "ACHIEVEMENT", "CUSTOM"]).default("CUSTOM"),
  issuerName: optionalTrimmedString,
  signerName: optionalTrimmedString,
  pageSize: z.enum(["A4_LANDSCAPE", "A4_PORTRAIT", "DIGITAL_CARD"]).default("A4_LANDSCAPE"),
  pageWidthMm: z.coerce.number().min(80).max(1200).nullish(),
  pageHeightMm: z.coerce.number().min(80).max(1200).nullish(),
  accentColor: safeHexColor,
  backgroundColor: safeHexColor,
  backgroundImageUrl: optionalDataImage,
  logoImageUrl: optionalDataImage,
  signatureImageUrl: optionalDataImage,
  sealImageUrl: optionalDataImage,
  elements: z.array(z.unknown()).max(40).optional(),
  isActive: z.boolean().default(true),
  definitionName: optionalTrimmedString,
  definitionNameEn: optionalTrimmedString,
  approvalMode: z.enum(["auto", "manual"]).default("auto"),
});

export type CertificateCategoryPayload = z.infer<typeof certificateCategoryPayloadSchema>;
export type CertificateTemplatePayload = z.infer<typeof certificateTemplatePayloadSchema>;

export function buildDefaultCertificateTemplateElements(): Prisma.InputJsonArray {
  return [
    {
      id: "kicker",
      kind: "TEXT",
      content: "Climate Passport Verified Credential",
      x: 8,
      y: 8,
      width: 84,
      height: 5,
      fontSize: 13,
      fontWeight: "700",
      color: "#60766f",
      textAlign: "center",
      zIndex: 10,
      visible: true,
    },
    {
      id: "certificate-name",
      kind: "VARIABLE",
      variable: "certificateName",
      x: 10,
      y: 20,
      width: 80,
      height: 15,
      fontSize: 46,
      fontWeight: "700",
      color: "#12382f",
      textAlign: "center",
      lineHeight: 1.1,
      zIndex: 10,
      visible: true,
    },
    {
      id: "holder-name",
      kind: "VARIABLE",
      variable: "holderName",
      x: 15,
      y: 42,
      width: 70,
      height: 10,
      fontSize: 34,
      fontWeight: "600",
      color: "#12382f",
      textAlign: "center",
      zIndex: 10,
      visible: true,
    },
    {
      id: "certificate-note",
      kind: "NOTE",
      content: "This credential certifies the verified participation, learning, role, or capability record represented by this certificate.",
      x: 18,
      y: 56,
      width: 64,
      height: 12,
      fontSize: 17,
      fontWeight: "400",
      color: "#36524b",
      textAlign: "center",
      lineHeight: 1.45,
      zIndex: 10,
      visible: true,
    },
    {
      id: "issue-date",
      kind: "VARIABLE",
      variable: "issueDate",
      label: "Issue date",
      x: 10,
      y: 78,
      width: 22,
      height: 7,
      fontSize: 14,
      color: "#36524b",
      textAlign: "left",
      zIndex: 10,
      visible: true,
    },
    {
      id: "certificate-number",
      kind: "VARIABLE",
      variable: "certificateNumber",
      label: "Certificate number",
      x: 36,
      y: 78,
      width: 30,
      height: 7,
      fontSize: 14,
      color: "#36524b",
      textAlign: "center",
      zIndex: 10,
      visible: true,
    },
    {
      id: "verification-qr",
      kind: "QR",
      x: 78,
      y: 72,
      width: 14,
      height: 16,
      zIndex: 12,
      visible: true,
    },
    {
      id: "seal",
      kind: "IMAGE",
      imageKey: "seal",
      x: 74,
      y: 52,
      width: 16,
      height: 16,
      zIndex: 11,
      visible: true,
    },
  ] as Prisma.InputJsonArray;
}

export function buildCertificateCategoryWriteData(
  payload: CertificateCategoryPayload,
  overrideOrder?: number,
): Prisma.CertificateCategoryUncheckedCreateInput {
  const data: Prisma.CertificateCategoryUncheckedCreateInput = {
    key: payload.key,
    name: payload.name,
    nameEn: payload.nameEn,
    description: payload.description,
    descriptionEn: payload.descriptionEn,
    autoIssueEnabled: payload.autoIssueEnabled,
    userRequestEnabled: payload.userRequestEnabled,
    pdfEnabled: payload.pdfEnabled,
    publicVerifyEnabled: payload.publicVerifyEnabled,
    isActive: payload.isActive,
  };

  const resolvedOrder = typeof overrideOrder === "number" ? overrideOrder : payload.order;
  if (typeof resolvedOrder === "number") {
    data.order = resolvedOrder;
  }

  return data;
}

export function buildCertificateTemplateRenderConfig(payload: CertificateTemplatePayload): Prisma.InputJsonObject {
  return {
    issuerName: payload.issuerName ?? "Climate Passport",
    signerName: payload.signerName ?? payload.issuerName ?? "Climate Passport",
    pageSize: payload.pageSize,
    pageWidthMm: payload.pageWidthMm,
    pageHeightMm: payload.pageHeightMm,
    accentColor: payload.accentColor ?? "#0e7c66",
    backgroundColor: payload.backgroundColor ?? "#f7fbf8",
    backgroundImageUrl: payload.backgroundImageUrl,
    logoImageUrl: payload.logoImageUrl,
    signatureImageUrl: payload.signatureImageUrl,
    sealImageUrl: payload.sealImageUrl,
    elements: sanitizeCertificateElements(payload.elements) ?? buildDefaultCertificateTemplateElements(),
  };
}

export function buildCertificateTemplateConfig(payload: CertificateTemplatePayload): Prisma.InputJsonObject {
  return {
    fields: [
      "holderName",
      "holderNameEn",
      "certificateName",
      "certificateNameEn",
      "categoryName",
      "categoryNameEn",
      "workName",
      "workNameEn",
      "projectName",
      "projectNameEn",
      "programName",
      "programNameEn",
      "eventName",
      "eventNameEn",
      "courseName",
      "courseNameEn",
      "roleName",
      "roleNameEn",
      "organizationName",
      "organizationNameEn",
      "institutionName",
      "institutionNameEn",
      "completionDate",
      "issueDate",
      "certificateNumber",
      "issuerName",
      "signer",
      "learningHours",
      "capabilityTags",
      "verificationUrl",
    ],
    qrPosition: "bottom-right",
    source: "admin-config",
    pageSize: payload.pageSize,
    pageWidthMm: payload.pageWidthMm,
    pageHeightMm: payload.pageHeightMm,
  };
}

export function buildCertificateTemplateWriteData(
  payload: CertificateTemplatePayload,
): Prisma.CertificateTemplateUncheckedCreateInput {
  return {
    categoryId: payload.categoryId,
    name: payload.name,
    nameEn: payload.nameEn,
    templateType: payload.templateType,
    templateConfigJson: buildCertificateTemplateConfig(payload),
    renderConfigJson: buildCertificateTemplateRenderConfig(payload),
    isActive: payload.isActive,
    version: 1,
  };
}

export function buildCertificateDefinitionWriteData(
  payload: CertificateTemplatePayload,
  templateId: string,
): Prisma.CertificateDefinitionUncheckedCreateInput {
  return {
    categoryId: payload.categoryId,
    templateId,
    name: payload.definitionName ?? payload.name,
    nameEn: payload.definitionNameEn ?? payload.nameEn,
    issueRule: {
      source: "MANUAL",
      autoIssue: false,
    },
    approvalMode: payload.approvalMode,
    verificationMode: "PUBLIC_CODE",
    isActive: payload.isActive,
  };
}
