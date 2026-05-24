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

const certificateElementSchema = z.object({
  id: z.string().trim().min(1).max(80),
  kind: z.enum(["TEXT", "VARIABLE", "IMAGE", "QR", "NOTE"]),
  label: z.string().trim().max(120).optional(),
  content: z.string().trim().max(1000).optional(),
  variable: z
    .enum([
      "holderName",
      "certificateName",
      "categoryName",
      "issueDate",
      "certificateNumber",
      "issuerName",
      "verificationUrl",
    ])
    .optional(),
  imageKey: z.enum(["logo", "signature", "seal"]).optional(),
  x: z.coerce.number().min(0).max(100),
  y: z.coerce.number().min(0).max(100),
  width: z.coerce.number().min(1).max(100),
  height: z.coerce.number().min(1).max(100),
  fontFamily: z.string().trim().max(120).optional(),
  fontSize: z.coerce.number().min(6).max(96).optional(),
  fontWeight: z.enum(["400", "500", "600", "700", "800"]).optional(),
  color: safeHexColor,
  textAlign: z.enum(["left", "center", "right"]).optional(),
  lineHeight: z.coerce.number().min(0.8).max(2.4).optional(),
  zIndex: z.coerce.number().int().min(0).max(100).optional(),
  visible: z.boolean().optional(),
});

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
  order: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});

export const certificateTemplatePayloadSchema = z.object({
  id: z.string().uuid().optional(),
  categoryId: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  nameEn: optionalTrimmedString,
  templateType: z.enum(["ATTENDANCE", "LEARNING", "ACHIEVEMENT", "CUSTOM"]).default("CUSTOM"),
  issuerName: optionalTrimmedString,
  pageSize: z.enum(["A4_LANDSCAPE", "A4_PORTRAIT", "DIGITAL_CARD"]).default("A4_LANDSCAPE"),
  accentColor: safeHexColor,
  backgroundColor: safeHexColor,
  backgroundImageUrl: optionalDataImage,
  logoImageUrl: optionalDataImage,
  signatureImageUrl: optionalDataImage,
  sealImageUrl: optionalDataImage,
  elements: z.array(certificateElementSchema).max(40).optional(),
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
): Prisma.CertificateCategoryUncheckedCreateInput {
  return {
    key: payload.key,
    name: payload.name,
    nameEn: payload.nameEn,
    description: payload.description,
    descriptionEn: payload.descriptionEn,
    order: payload.order,
    isActive: payload.isActive,
  };
}

export function buildCertificateTemplateRenderConfig(payload: CertificateTemplatePayload): Prisma.InputJsonObject {
  return {
    issuerName: payload.issuerName ?? "Climate Passport",
    pageSize: payload.pageSize,
    accentColor: payload.accentColor ?? "#0e7c66",
    backgroundColor: payload.backgroundColor ?? "#f7fbf8",
    backgroundImageUrl: payload.backgroundImageUrl,
    logoImageUrl: payload.logoImageUrl,
    signatureImageUrl: payload.signatureImageUrl,
    sealImageUrl: payload.sealImageUrl,
    elements: payload.elements && payload.elements.length > 0
      ? payload.elements
      : buildDefaultCertificateTemplateElements(),
  };
}

export function buildCertificateTemplateConfig(payload: CertificateTemplatePayload): Prisma.InputJsonObject {
  return {
    fields: [
      "holderName",
      "certificateName",
      "projectName",
      "eventName",
      "issueDate",
      "certificateNumber",
      "issuerName",
      "competencyTags",
    ],
    qrPosition: "bottom-right",
    source: "admin-config",
    pageSize: payload.pageSize,
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
