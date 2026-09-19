import { z } from "zod";

export const API_ERROR_CODES = [
  "UNAUTHENTICATED", "INVALID_REQUEST", "INVALID_BRIDGE_TOKEN", "CHANNEL_DISABLED",
  "RATE_LIMITED", "SERVICE_UNAVAILABLE", "INTERNAL_ERROR", "EXTERNAL_LEARNING_PROVIDER_NOT_FOUND",
  "EXTERNAL_LEARNING_WEBHOOK_REJECTED", "EXTERNAL_LEARNING_REPLAY_REJECTED",
] as const;
export const ApiErrorCodeSchema = z.enum(API_ERROR_CODES);
export const ApiErrorSchema = z.object({ error: z.object({ code: ApiErrorCodeSchema }) }).strict();

export const ChannelKeySchema = z.literal("SHCW");
export type ChannelKey = z.infer<typeof ChannelKeySchema>;

export const BridgeIssueRequestSchema = z.object({
  channel: ChannelKeySchema,
  targetPath: z.string().max(2048).optional(),
}).strict();
export const BridgeIssueResponseSchema = z.object({
  ok: z.literal(true),
  bridgeToken: z.object({ token: z.string().min(1), channel: ChannelKeySchema, expiresAt: z.string().datetime(), targetPath: z.string().nullable() }).strict(),
}).strict();
export const BridgeExchangeRequestSchema = z.object({
  channel: ChannelKeySchema,
  token: z.string().min(1).max(1024),
  locale: z.enum(["en", "zh", "fr", "de"]).default("en"),
}).strict();
export const BridgeExchangeResponseSchema = z.object({ ok: z.literal(true), redirectTo: z.string().startsWith("/") }).strict();

export const PublicCertificateStatusSchema = z.enum(["PREVIEW", "NOT_FOUND", "VALID", "REVOKED", "EXPIRED", "INVALID"]);
export const PublicCertificateVerificationResponseSchema = z.object({
  status: PublicCertificateStatusSchema,
  valid: z.boolean(),
  verificationCode: z.string(),
  message: z.string().optional(),
  certificate: z.object({
    title: z.string(), holderName: z.string(), maskedPassportId: z.string().nullable(),
    issuingOrganization: z.string(), issuedAt: z.string().nullable(), expiryDate: z.string().nullable(),
    credentialType: z.string(), certificateNumber: z.string().nullable(), verifiedAt: z.string(),
  }).strict().optional(),
}).strict();

export type ApiError = z.infer<typeof ApiErrorSchema>;
export type BridgeIssueRequest = z.infer<typeof BridgeIssueRequestSchema>;
export type BridgeIssueResponse = z.infer<typeof BridgeIssueResponseSchema>;
export type BridgeExchangeRequest = z.infer<typeof BridgeExchangeRequestSchema>;
export type BridgeExchangeResponse = z.infer<typeof BridgeExchangeResponseSchema>;
export type PublicCertificateVerificationResponse = z.infer<typeof PublicCertificateVerificationResponseSchema>;

export const ExternalLearningProviderStatusSchema = z.enum(["DRAFT", "ACTIVE", "DISABLED"]);
export const ExternalLearningAccountStatusSchema = z.enum(["PENDING", "VERIFIED", "DISABLED"]);
export const ExternalLearningMappingStatusSchema = z.enum(["ACTIVE", "DISABLED"]);
export const ExternalLearningProviderPayloadSchema = z.object({
  key: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/), webhookPathKey: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/),
  displayName: z.string().trim().min(1).max(120), status: ExternalLearningProviderStatusSchema.default("DRAFT"),
  signingSecretRef: z.string().trim().min(1).max(200).optional(),
  verificationConfig: z.object({ algorithm: z.literal("HMAC-SHA256"), signatureHeader: z.string().min(1).max(80), timestampHeader: z.string().min(1).max(80), deliveryIdHeader: z.string().min(1).max(80), eventTypeHeader: z.string().min(1).max(80) }).strict().optional(),
}).strict();
export const ExternalLearningAccountPayloadSchema = z.object({ providerId: z.string().uuid(), userId: z.string().uuid(), externalSubjectId: z.string().trim().min(1).max(1024), status: ExternalLearningAccountStatusSchema.default("PENDING") }).strict();
export const ExternalLearningCourseMappingPayloadSchema = z.object({ providerId: z.string().uuid(), externalCourseId: z.string().trim().min(1).max(1024), learningExperienceProgramId: z.string().uuid().optional(), activityId: z.string().uuid().optional(), status: ExternalLearningMappingStatusSchema.default("ACTIVE") }).strict().superRefine((value, ctx) => { if (Boolean(value.learningExperienceProgramId) === Boolean(value.activityId)) ctx.addIssue({ code: "custom", message: "Exactly one target is required." }); });
export const ExternalLearningAccountUpdateSchema = z.object({ id: z.string().uuid(), action: z.enum(["VERIFY", "DISABLE"]) }).strict();
export const ExternalLearningCourseMappingUpdateSchema = z.object({ id: z.string().uuid(), action: z.enum(["ACTIVATE", "DISABLE"]) }).strict();
export const ExternalLearningAdminListQuerySchema = z.object({ cursor: z.string().uuid().optional(), limit: z.coerce.number().int().min(1).max(100).default(50) }).strict();
export type ExternalLearningProviderPayload = z.infer<typeof ExternalLearningProviderPayloadSchema>;
