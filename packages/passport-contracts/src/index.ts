import { z } from "zod";

export const API_ERROR_CODES = [
  "OUTCOME_SOURCE_DENIED", "OUTCOME_BINDING_DENIED", "OUTCOME_CONSENT_DENIED",
  "OUTCOME_CONFLICT", "OUTCOME_STALE", "OUTCOME_REVOKED", "OUTCOME_NOT_FOUND", "OUTCOME_BLOCKED",
  "UNAUTHENTICATED", "INVALID_REQUEST", "INVALID_BRIDGE_TOKEN", "CHANNEL_DISABLED",
  "RATE_LIMITED", "SERVICE_UNAVAILABLE", "INTERNAL_ERROR", "EXTERNAL_LEARNING_PROVIDER_NOT_FOUND",
  "EXTERNAL_LEARNING_WEBHOOK_REJECTED", "EXTERNAL_LEARNING_REPLAY_REJECTED",
  "CHANNEL_MACHINE_AUTH_FAILED", "CHANNEL_SCOPE_DENIED", "CHANNEL_ORIGIN_DENIED",
  // CP-TODO-247 generic private records
  "RECORD_NOT_FOUND", "RECORD_ACCESS_DENIED", "RECORD_REVISION_CONFLICT", "RECORD_WITHDRAWN",
  // CP-TODO-248 controlled assets
  "ASSET_NOT_FOUND", "ASSET_ACCESS_DENIED", "ASSET_INTEGRITY_MISMATCH", "ASSET_CONTENT_TYPE_MISMATCH",
  "ASSET_SCAN_PENDING", "ASSET_SCAN_FAILED",
  // CP-TODO-249 consents
  "CONSENT_NOT_FOUND", "CONSENT_REQUIRED", "CONSENT_WITHDRAWN", "GUARDIAN_LINK_REQUIRED",
  // CP-TODO-250 external decision receipts
  "RECEIPT_CONFLICT", "RECEIPT_STALE", "RECEIPT_ISSUER_UNVERIFIED",
  // CP-TODO-251 publication gateway
  "PUBLICATION_NOT_FOUND", "PUBLICATION_CONFLICT", "PUBLICATION_RESTORE_FORBIDDEN",
  // CP-TODO-245 activity source mapping
  "SOURCE_MAPPING_NOT_FOUND", "SOURCE_MAPPING_CONFLICT", "SOURCE_MAPPING_STALE",
  "ACTIVITY_SOURCE_NOT_PUBLISHED", "ACTIVITY_SOURCE_CANCELLED", "ACTIVITY_SOURCE_FIELD_CONFLICT",
  // CP-TODO-246 occurrences, multi-role assignments, taxonomy references, attendance correction
  "OCCURRENCE_NOT_FOUND", "OCCURRENCE_UNAVAILABLE", "OCCURRENCE_FULL",
  "TAXONOMY_CONFLICT", "TAXONOMY_STALE", "TAXONOMY_NOT_FOUND",
  "ATTENDANCE_CORRECTION_REASON_REQUIRED", "ATTENDANCE_ALREADY_RECORDED", "PARTICIPATION_NOT_FOUND",
  // CP-TODO-253 person/institution contribution facts
  "CONTRIBUTION_NOT_FOUND", "CONTRIBUTION_CONFLICT", "CONTRIBUTION_VERIFICATION_INVALID", "CONTRIBUTION_ACCESS_DENIED",
  // CP-TODO-257 notification delivery, privacy reports, export/deletion, marker replay
  "NOTIFICATION_NOT_FOUND", "PRIVACY_DELETE_CONFIRMATION_REQUIRED", "PRIVACY_MARKER_REPLAY_INCOMPLETE",
  // CP-TODO-252 generic source references and schema contracts
  "SOURCE_REF_NOT_FOUND", "SOURCE_SCHEMA_UNKNOWN",
  // Open API (API Key control mode): presented key missing/rejected/expired, or denied by
  // scope, browser origin or caller-address allowlist.
  "API_KEY_MISSING", "API_KEY_INVALID", "API_KEY_EXPIRED",
  "API_KEY_SCOPE_DENIED", "API_KEY_ORIGIN_DENIED", "API_KEY_IP_DENIED",
  // Dual-header machine channel: same denial reasons, channel-prefixed naming.
  "CHANNEL_MACHINE_KEY_EXPIRED", "CHANNEL_IP_DENIED",
] as const;
export const ApiErrorCodeSchema = z.enum(API_ERROR_CODES);
export const ApiErrorSchema = z.object({ error: z.object({ code: ApiErrorCodeSchema }) }).strict();

// CP-TODO-241: channel keys are registered via the ChannelClient table instead of a fixed
// literal. "SHCW" stays valid; unregistered keys are rejected by the serving routes.
export const CHANNEL_KEY_PATTERN = /^[A-Z0-9][A-Z0-9_-]{0,62}$/;
export const ChannelKeySchema = z.string().regex(CHANNEL_KEY_PATTERN);
export type ChannelKey = z.infer<typeof ChannelKeySchema>;

// CP-TODO-243: machine-client scope catalog. Registered ChannelClient rows carry
// allowedScopes; every machine-authenticated v1 call must present a scope from
// this catalog, and unknown scopes are rejected at registration time.
export const CHANNEL_SCOPE_VALUES = [
  "channel:outcomes:write",
  "channel:outcomes:reconcile",
  "channel:session:bridge",
  "channel:session:exchange",
  "channel:certificates:verify",
  "dispatch:certificates:lifecycle",
  // CP-TODO-250: machine clients submit minimal external decision/revocation receipts.
  "channel:decisions:submit",
  // CP-TODO-251: publication publish/withdraw fan-out to subscribed machine clients.
  "dispatch:publications",
  // CP-TODO-245: registered source systems bind/apply/publish/cancel activities.
  "channel:activities:source",
  // CP-TODO-252: registered programmes resolve generic source references.
  "channel:source:resolve",
] as const;
export const ChannelScopeSchema = z.enum(CHANNEL_SCOPE_VALUES);
export type ChannelScope = z.infer<typeof ChannelScopeSchema>;

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

// ─────────────────────────────────────────────────────────────────────────────
// CP-TODO-247~251: generic private records, controlled assets, consents,
// external decision receipts and the publication gateway (Wave 1).
// ─────────────────────────────────────────────────────────────────────────────

// CP-TODO-249: purposes are handled separately (CP-FR-060). A consent granted for
// one purpose/channel never authorizes another.
export const CONSENT_PURPOSE_VALUES = [
  "private_archive",
  "reward_qualification",
  "account_terms",
  "programme_operation",
  "image_use",
  "attribution",
  "contact",
  "endorsement",
] as const;
export const ConsentPurposeSchema = z.enum(CONSENT_PURPOSE_VALUES);
export type ConsentPurpose = z.infer<typeof ConsentPurposeSchema>;

export const RECORD_GRANT_ACTIONS = ["READ", "WRITE"] as const;
export const RecordGrantActionSchema = z.enum(RECORD_GRANT_ACTIONS);

export const RECORD_TYPE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,62}$/;
export const ScopedRecordCreateSchema = z.object({
  recordType: z.string().regex(RECORD_TYPE_PATTERN),
  title: z.string().trim().min(1).max(200),
  payloadJson: z.record(z.string(), z.unknown()),
  programmeId: z.string().uuid().optional(),
}).strict();
export type ScopedRecordCreate = z.infer<typeof ScopedRecordCreateSchema>;

export const ScopedRecordUpdateSchema = z.object({
  expectedRevision: z.number().int().min(1),
  payloadJson: z.record(z.string(), z.unknown()),
}).strict();
export type ScopedRecordUpdate = z.infer<typeof ScopedRecordUpdateSchema>;

export const RecordGrantSchema = z.object({
  subjectUserId: z.string().uuid(),
  action: RecordGrantActionSchema,
  purpose: z.string().trim().min(1).max(80).optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
}).strict();
export type RecordGrant = z.infer<typeof RecordGrantSchema>;

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
export const CONTROLLED_ASSET_PURPOSES = ["evidence", "portfolio", "publication_media"] as const;
export const AssetRegisterSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(3).max(120),
  byteSize: z.number().int().min(1).max(100 * 1024 * 1024),
  sha256: z.string().regex(SHA256_HEX_PATTERN),
  purpose: z.enum(CONTROLLED_ASSET_PURPOSES).default("evidence"),
}).strict();
export type AssetRegister = z.infer<typeof AssetRegisterSchema>;

export const EvidenceVersionCreateSchema = z.object({
  recordId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  derivedFromAssetId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  snapshotJson: z.record(z.string(), z.unknown()).default({}),
}).strict().superRefine((value, ctx) => {
  if (!value.recordId && !value.assetId && !value.derivedFromAssetId) {
    ctx.addIssue({ code: "custom", message: "At least one of recordId, assetId or derivedFromAssetId is required." });
  }
});
export type EvidenceVersionCreate = z.infer<typeof EvidenceVersionCreateSchema>;

export const ConsentGrantSchema = z.object({
  subjectUserId: z.string().uuid(),
  purpose: ConsentPurposeSchema,
  channel: z.string().trim().min(1).max(80).optional(),
  programmeId: z.string().uuid().optional(),
  objectType: z.string().trim().min(1).max(64).optional(),
  objectId: z.string().trim().min(1).max(128).optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  guardianUserId: z.string().uuid().optional(),
  evidenceJson: z.record(z.string(), z.unknown()).optional(),
}).strict();
export type ConsentGrant = z.infer<typeof ConsentGrantSchema>;

export const DECISION_RECEIPT_DECISIONS = ["APPROVED", "REJECTED", "REVOKED"] as const;
export const DecisionReceiptDecisionSchema = z.enum(DECISION_RECEIPT_DECISIONS);

// CP-TODO-250: receipts stay minimal — issuer, scope, object version and purpose
// are validated, business queues/review criteria stay with the programme (CP-FR-059).
export const DecisionReceiptSubmitSchema = z.object({
  objectType: z.string().trim().min(1).max(64),
  objectId: z.string().trim().min(1).max(128),
  objectRevision: z.number().int().min(1),
  purpose: z.string().trim().min(1).max(80),
  decision: DecisionReceiptDecisionSchema,
  minimalJson: z.record(z.string(), z.unknown()),
  signature: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().trim().min(1).max(128),
  validUntil: z.string().datetime().optional(),
}).strict();
export type DecisionReceiptSubmit = z.infer<typeof DecisionReceiptSubmitSchema>;

// CP-TODO-251: only approved versions are published; author intent, review, release,
// effective version, channel and license are independent dimensions (CP-FR-061).
export const PublicationUpsertSchema = z.object({
  objectType: z.string().trim().min(1).max(64),
  objectId: z.string().trim().min(1).max(128),
  version: z.number().int().min(1),
  projectionJson: z.record(z.string(), z.unknown()),
  channel: z.string().trim().min(1).max(80).optional(),
  license: z.string().trim().min(1).max(120).optional(),
  programmeId: z.string().uuid().optional(),
  consentRequirements: z.array(z.object({
    subjectUserId: z.string().uuid(),
    purpose: ConsentPurposeSchema,
  }).strict()).max(50).optional(),
  /** 强制「只发布批准版本」：要求对象存在该版本及以上的 APPROVED 外部决定回执。 */
  approvalReceipt: z.boolean().optional(),
}).strict();
export type PublicationUpsert = z.infer<typeof PublicationUpsertSchema>;

// CP-TODO-245: formal activity source mapping execution layer (CP-FR-053).
// Source-owned fields are applied only within the mapping's authoritative-field
// whitelist; CP registration/check-in state is never source-writable.
export const ACTIVITY_SOURCE_OWNED_FIELD_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,40}$/;
export const SourceActivityBindSchema = z.object({
  sourceEditionRef: z.string().trim().min(1).max(120).optional(),
  sourceObjectId: z.string().trim().min(1).max(128),
  activityId: z.string().uuid(),
  editionId: z.string().uuid().optional(),
  authoritativeFields: z.array(z.string().regex(ACTIVITY_SOURCE_OWNED_FIELD_PATTERN)).min(1).max(40),
  idempotencyKey: z.string().trim().min(1).max(128),
}).strict();
export type SourceActivityBind = z.infer<typeof SourceActivityBindSchema>;

export const SourceActivityRevisionSchema = z.object({
  sourceObjectId: z.string().trim().min(1).max(128),
  sourceEditionRef: z.string().trim().min(1).max(120).optional(),
  sourceVersion: z.string().trim().min(1).max(40),
  fields: z.record(z.string().regex(ACTIVITY_SOURCE_OWNED_FIELD_PATTERN), z.unknown()),
  idempotencyKey: z.string().trim().min(1).max(128),
}).strict();
export type SourceActivityRevision = z.infer<typeof SourceActivityRevisionSchema>;

export const SourceActivityPublishSchema = z.object({
  sourceObjectId: z.string().trim().min(1).max(128),
  sourceEditionRef: z.string().trim().min(1).max(120).optional(),
  sourceVersion: z.string().trim().min(1).max(40),
  projectionJson: z.record(z.string(), z.unknown()),
  channel: z.string().trim().min(1).max(80).optional(),
  idempotencyKey: z.string().trim().min(1).max(128),
}).strict();
export type SourceActivityPublish = z.infer<typeof SourceActivityPublishSchema>;

export const SourceActivityCancelSchema = z.object({
  sourceObjectId: z.string().trim().min(1).max(128),
  sourceEditionRef: z.string().trim().min(1).max(120).optional(),
  reason: z.string().trim().min(1).max(300).optional(),
  idempotencyKey: z.string().trim().min(1).max(128),
}).strict();
export type SourceActivityCancel = z.infer<typeof SourceActivityCancelSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// CP-TODO-246: generic occurrences with atomic admission capacity, per-person
// multi-role assignments (statistics count a person once), external taxonomy
// classification references, and attendance correction (CP-FR-054/055/056).
// ─────────────────────────────────────────────────────────────────────────────

export const OCCURRENCE_STATUSES = ["SCHEDULED", "CANCELLED", "COMPLETED"] as const;
export const OccurrenceStatusSchema = z.enum(OCCURRENCE_STATUSES);

export const ActivityOccurrenceInputSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  capacity: z.number().int().min(1).max(100000).optional(),
  locationJson: z.record(z.string(), z.unknown()).optional(),
  status: OccurrenceStatusSchema.optional(),
}).strict();
export type ActivityOccurrenceInput = z.infer<typeof ActivityOccurrenceInputSchema>;

export const ActivityOccurrenceUpdateSchema = ActivityOccurrenceInputSchema.partial().strict();
export type ActivityOccurrenceUpdate = z.infer<typeof ActivityOccurrenceUpdateSchema>;

export const ACTIVITY_PERSON_ROLE_TYPE_PATTERN = /^[A-Z][A-Z0-9_]{1,39}$/;
export const ActivityPersonRoleAssignSchema = z.object({
  personId: z.string().uuid(),
  roleType: z.string().regex(ACTIVITY_PERSON_ROLE_TYPE_PATTERN),
  sourceType: z.string().trim().min(1).max(64).optional(),
  sourceId: z.string().trim().min(1).max(128).optional(),
  note: z.string().trim().min(1).max(500).optional(),
}).strict();
export type ActivityPersonRoleAssign = z.infer<typeof ActivityPersonRoleAssignSchema>;

export const TAXONOMY_SYSTEM_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,62}$/;
export const ActivityTaxonomySetSchema = z.object({
  activityId: z.string().uuid(),
  taxonomySystem: z.string().regex(TAXONOMY_SYSTEM_PATTERN),
  taxonomyRef: z.string().trim().min(1).max(128),
  labelJson: z.record(z.string(), z.unknown()).optional(),
  sourceVersion: z.number().int().min(1).max(1000000).default(1),
  idempotencyKey: z.string().trim().min(1).max(128),
}).strict();
export type ActivityTaxonomySet = z.infer<typeof ActivityTaxonomySetSchema>;

export const ActivityTaxonomyWithdrawSchema = z.object({
  activityId: z.string().uuid(),
  taxonomySystem: z.string().regex(TAXONOMY_SYSTEM_PATTERN),
  taxonomyRef: z.string().trim().min(1).max(128),
  sourceVersion: z.number().int().min(1).max(1000000),
  idempotencyKey: z.string().trim().min(1).max(128),
}).strict();
export type ActivityTaxonomyWithdraw = z.infer<typeof ActivityTaxonomyWithdrawSchema>;

export const AttendanceCorrectionSchema = z.object({
  reason: z.string().trim().min(1).max(500),
  evidenceAssetIds: z.array(z.string().uuid()).max(10).optional(),
  checkinAt: z.string().datetime().optional(),
}).strict();
export type AttendanceCorrection = z.infer<typeof AttendanceCorrectionSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// CP-TODO-253: person/institution contribution facts with evaluated verification
// levels, correction chains and derived statistics (CP-FR-062).
// ─────────────────────────────────────────────────────────────────────────────

// 等级单调可升不可降；自报事实的起点，绝不因录入人身份自动升级为第三方核验。
export const CONTRIBUTION_VERIFICATION_LEVEL_VALUES = [
  "UNVERIFIED",
  "SELF_REPORTED",
  "ORGANIZATION_CONFIRMED",
  "INDEPENDENTLY_VERIFIED",
] as const;
export const ContributionVerificationLevelSchema = z.enum(CONTRIBUTION_VERIFICATION_LEVEL_VALUES);

export const CONTRIBUTION_TYPE_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,62}$/;
export const CONTRIBUTION_SOURCE_TYPE_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,62}$/;

export const ContributionQuantitiesSchema = z.object({
  plannedUnits: z.number().min(0).optional(),
  confirmedUnits: z.number().min(0).optional(),
  actualUnits: z.number().min(0).optional(),
  completedUnits: z.number().min(0).optional(),
}).strict();
export type ContributionQuantities = z.infer<typeof ContributionQuantitiesSchema>;

export const ContributionRecordSchema = z.object({
  personId: z.string().uuid(),
  contributionType: z.string().regex(CONTRIBUTION_TYPE_PATTERN),
  institutionId: z.string().uuid().optional(),
  programmeId: z.string().uuid().optional(),
  sourceType: z.string().regex(CONTRIBUTION_SOURCE_TYPE_PATTERN).optional(),
  sourceId: z.string().trim().min(1).max(128).optional(),
  occurredAt: z.string().datetime().optional(),
  quantities: ContributionQuantitiesSchema.optional(),
  note: z.string().trim().min(1).max(500).optional(),
}).strict();
export type ContributionRecord = z.infer<typeof ContributionRecordSchema>;

export const ContributionEvaluateSchema = z.object({
  verificationLevel: ContributionVerificationLevelSchema,
  reason: z.string().trim().min(1).max(300),
}).strict();
export type ContributionEvaluate = z.infer<typeof ContributionEvaluateSchema>;

export const ContributionCorrectSchema = z.object({
  reason: z.string().trim().min(1).max(300),
  quantities: ContributionQuantitiesSchema.optional(),
  note: z.string().trim().min(1).max(500).optional(),
}).strict();
export type ContributionCorrect = z.infer<typeof ContributionCorrectSchema>;

export const ContributionWithdrawSchema = z.object({
  reason: z.string().trim().min(1).max(300),
}).strict();
export type ContributionWithdraw = z.infer<typeof ContributionWithdrawSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// CP-TODO-257: notification delivery retry evidence, privacy-safe aggregate
// reports, scoped self-export / account deletion and backup privacy-marker
// replay (CP-FR-066/067/068).
// ─────────────────────────────────────────────────────────────────────────────

export const NOTIFICATION_CHANNEL_VALUES = ["EMAIL", "IN_APP", "SMS"] as const;
export const NotificationChannelPreferenceSchema = z.enum(NOTIFICATION_CHANNEL_VALUES);

export const NotificationProcessSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
}).strict();
export type NotificationProcess = z.infer<typeof NotificationProcessSchema>;

export const ActivityPrivacyReportQuerySchema = z.object({
  activityId: z.string().uuid(),
}).strict();

export const AccountDeleteSchema = z.object({
  reason: z.string().trim().min(1).max(300),
  /** 导出/撤回/删除三个动作分开；删除必须显式确认。 */
  confirm: z.literal(true),
}).strict();
export type AccountDelete = z.infer<typeof AccountDeleteSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// CP-TODO-252: generic external references (sourceRef) with versioned schema
// contracts and field whitelists (CP-FR-071). Programmes register a source
// system (ChannelClient key) and reference CP objects without understanding
// programme-specific models; CP never executes proprietary rules.
// ─────────────────────────────────────────────────────────────────────────────

export const SOURCE_REF_OBJECT_TYPES = ["person", "institution", "activity", "record"] as const;
export const SourceRefObjectTypeSchema = z.enum(SOURCE_REF_OBJECT_TYPES);

/**
 * Open API 引用解析请求：不含 `system` 字段。调用方是谁由 API Key 决定，
 * 来源系统即该 key 自己的 clientKey——允许 body 另填 system 等于允许替别人解析。
 */
export const OpenApiSourceRefRequestSchema = z.object({
  objectType: SourceRefObjectTypeSchema,
  objectId: z.string().trim().min(1).max(128),
}).strict();
export type OpenApiSourceRefRequest = z.infer<typeof OpenApiSourceRefRequestSchema>;

export const SourceRefResolveResponseSchema = z.object({
  ok: z.literal(true),
  system: ChannelKeySchema,
  objectType: SourceRefObjectTypeSchema,
  objectId: z.string().min(1).max(128),
  /** 版本化 schema 引用（如 cp.person_identity/v1），调用方按此校验投影。 */
  schemaRef: z.string().min(1).max(80),
  /** CP 侧定位符（读取仍需相应授权）。 */
  locator: z.string().min(1).max(300),
  /** 投影内容的 sha256，供来源方做版本快照与对账。 */
  contentHash: z.string().regex(SHA256_HEX_PATTERN),
  projection: z.record(z.string(), z.unknown()),
}).strict();
export type SourceRefResolveResponse = z.infer<typeof SourceRefResolveResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Open API (API Key control mode). Outward-facing endpoints authenticate with a
// bearer API key instead of a cookie session, so they need an error envelope a
// third party can branch on: a stable machine code plus a human-readable message
// and a request id that matches the server-side audit row.
// ─────────────────────────────────────────────────────────────────────────────

export const OpenApiErrorSchema = z.object({
  error: z.object({
    code: ApiErrorCodeSchema,
    message: z.string().min(1).max(300),
    requestId: z.string().min(1).max(64).optional(),
    retryAfter: z.number().int().min(0).optional(),
  }).strict(),
}).strict();
export type OpenApiError = z.infer<typeof OpenApiErrorSchema>;

/** Cursor pagination envelope shared by every list-shaped Open API endpoint. */
export const OpenApiPageMetaSchema = z.object({
  limit: z.number().int().min(1).max(200),
  nextCursor: z.string().max(200).nullable(),
}).strict();
export type OpenApiPageMeta = z.infer<typeof OpenApiPageMetaSchema>;

/** Key introspection: what the caller is, what that key may read, and how long it stays valid. */
export const OpenApiWhoamiResponseSchema = z.object({
  ok: z.literal(true),
  clientId: z.string().uuid(),
  clientKey: ChannelKeySchema,
  displayName: z.string(),
  programmeId: z.string().uuid(),
  scopes: z.array(z.string()),
  requestId: z.string().min(1).max(64),
  /** Effective quota for this key, not the server default. */
  rateLimit: z.object({
    limit: z.number().int(),
    windowMs: z.number().int(),
    remaining: z.number().int(),
    resetAt: z.number().int(),
  }).strict(),
  key: z.object({
    /** `sha256-legacy` rows predate bcrypt storage and stop working once rotated. */
    algorithm: z.enum(["bcrypt", "sha256-legacy"]),
    issuedAt: z.string().datetime().nullable(),
    /** Null means issued before expiry policy existed; rotation always sets it. */
    expiresAt: z.string().datetime().nullable(),
    rotatedAt: z.string().datetime().nullable(),
    lastUsedAt: z.string().datetime().nullable(),
  }).strict(),
  /** The caller's own allowlists: empty origins means browser use is not possible at all. */
  access: z.object({
    allowedOrigins: z.array(z.string()),
    allowedIps: z.array(z.string()),
  }).strict(),
}).strict();
export type OpenApiWhoamiResponse = z.infer<typeof OpenApiWhoamiResponseSchema>;

/**
 * 对外回执列表项：只回可对账的字段。`minimalJson` 与 `signature` 留在 CP 侧——
 * 提交方本来就有自己的副本，公开它们只会扩大泄漏面。
 */
export const OpenApiDecisionReceiptSchema = z.object({
  id: z.string().min(1).max(64),
  issuerKey: ChannelKeySchema,
  programmeId: z.string().uuid().nullable(),
  objectType: z.string().min(1).max(64),
  objectId: z.string().min(1).max(128),
  objectRevision: z.number().int().min(1),
  purpose: z.string().min(1).max(80),
  decision: DecisionReceiptDecisionSchema,
  contentHash: z.string().regex(SHA256_HEX_PATTERN).nullable(),
  validUntil: z.string().datetime().nullable(),
  status: z.string().min(1).max(40),
  receivedAt: z.string().datetime(),
}).strict();
export type OpenApiDecisionReceipt = z.infer<typeof OpenApiDecisionReceiptSchema>;

export const OpenApiDecisionReceiptListResponseSchema = z.object({
  ok: z.literal(true),
  receipts: z.array(OpenApiDecisionReceiptSchema).max(200),
  page: OpenApiPageMetaSchema,
}).strict();
export type OpenApiDecisionReceiptListResponse = z.infer<typeof OpenApiDecisionReceiptListResponseSchema>;

// Authoritative private application outcomes, app-outcome/1.
const token = z.string().min(1).max(256).regex(/^[A-Za-z0-9:_-]+$/);
const version = z.number().int().min(1).max(2147483647);
const identity = z.object({ issuer: z.string().url().max(256), subject: z.string().min(1).max(256) }).strict();
const base = {
  schemaVersion: z.literal("app-outcome/1"), eventId: token,
  sourceApp: z.enum(["gca", "fs", "gpti", "100cc", "shcw2027"]),
  sourceAuthority: token, identity,
  sourceRecord: z.object({ id: token, version }).strict(), occurredAt: z.string().datetime(),
};
const consent = z.object({ receiptId: token, version, scope: z.literal("private_archive"), grantedAt: z.string().datetime() }).strict();
const data = z.object({ kind: z.enum(["course_completion", "approved_private_evidence", "learning_completion", "course_evidence", "portfolio_evidence", "action_completion", "member_contribution", "activity_participation"]), status: z.enum(["completed", "accepted"]), evidenceRefs: z.array(token).max(10).refine(v => new Set(v).size === v.length) }).strict();
export const AppOutcomeEventSchema = z.discriminatedUnion("operation", [
  z.object({ ...base, operation: z.literal("upsert"), consent, data }).strict(),
  z.object({ ...base, operation: z.literal("correct"), supersedesEventId: token, consent, data }).strict(),
  z.object({ ...base, operation: z.literal("revoke"), supersedesEventId: token }).strict(),
]);
export type AppOutcomeEnvelope = z.infer<typeof AppOutcomeEventSchema>;
export const APP_OUTCOME_KINDS = {
  gca: ["course_completion", "learning_completion", "course_evidence"], fs: ["approved_private_evidence", "portfolio_evidence"],
  gpti: ["action_completion"], "100cc": ["member_contribution"], shcw2027: ["activity_participation"],
} as const;

export const AppOutcomeReceiptSchema = z.object({
  schemaVersion: z.literal("app-outcome/1"), applied: z.boolean(),
  state: z.enum(["applied", "gap_pending", "blocked"]), eventId: token,
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  sourceRecord: z.object({ id: token, version }).strict(),
  stream: z.string().max(2048), remoteRecordRef: z.string().uuid(),
  currentVersion: z.number().int().min(0).max(2147483647), terminalRevoked: z.boolean(),
}).strict();


// CP-GOV-001..010. app-outcome/1 retains private archive semantics unchanged.
export const GovernanceConditionSchema = z.object({schemaVersion:z.literal("cp-condition/1"),all:z.array(z.union([
 z.object({field:z.enum(["kind","status","verificationLevel"]),op:z.literal("eq"),value:z.string().min(1).max(80)}).strict(),
 z.object({field:z.enum(["durationMinutes","score"]),op:z.literal("gte"),value:z.number().finite().min(0).max(1000000)}).strict(),
])).max(16)}).strict();
export const GovernanceRewardsSchema = z.array(z.discriminatedUnion("type",[
 z.object({type:z.literal("POINTS"),points:z.number().int().min(1).max(1000000)}).strict(),
 z.object({type:z.literal("BADGE"),badgeDefinitionId:z.string().uuid(),issuerInstitutionId:z.string().uuid(),credentialClass:z.enum(["participation","completion","competence"])}).strict(),
 z.object({type:z.literal("CERTIFICATE"),certificateDefinitionId:z.string().uuid(),issuerInstitutionId:z.string().uuid(),credentialClass:z.enum(["participation","completion","competence"])}).strict(),
])).max(3).refine(rewards=>new Set(rewards.map(r=>r.type)).size===rewards.length,"One reward per type per rule");
export const GovernanceFactsSchema = z.object({kind:z.enum(["learning_completion","approved_private_evidence"]),status:z.enum(["completed","accepted"]),verificationLevel:z.literal("source_verified"),durationMinutes:z.number().finite().min(0).max(1000000).optional(),score:z.number().finite().min(0).max(1000000).optional(),evidenceRefs:z.array(z.string().min(1).max(180)).min(1).max(20)}).strict();
const governanceId = z.string().uuid();
const governanceEventId=z.string().min(1).max(180);
const governanceConsent=z.object({receiptId:governanceId,version:z.number().int().min(1),scope:z.literal("reward_qualification"),grantedAt:z.string().datetime()}).strict();
const governanceEventFields={schemaVersion:z.literal("cp-governance/1"),eventId:governanceEventId,bindingId:governanceId,ruleVersionId:governanceId,identity:z.object({issuer:z.string().url().max(300),subject:z.string().min(1).max(300)}).strict(),sourceRecord:z.object({id:z.string().min(1).max(180),version:z.number().int().min(1)}).strict(),occurredAt:z.string().datetime()};
export const GovernanceQualificationSchema=z.discriminatedUnion("operation",[
 z.object({...governanceEventFields,operation:z.literal("upsert"),consent:governanceConsent,data:GovernanceFactsSchema}).strict(),
 z.object({...governanceEventFields,operation:z.literal("correct"),supersedesEventId:governanceEventId,consent:governanceConsent,data:GovernanceFactsSchema}).strict(),
 z.object({...governanceEventFields,operation:z.literal("revoke"),supersedesEventId:governanceEventId}).strict(),
]);
export const GovernanceCommandSchema=z.discriminatedUnion("action",[
 z.object({action:z.literal("register"),programmeId:governanceId,institutionId:governanceId,activityId:governanceId.optional(),kind:z.enum(["learning_unit","conference","activity","challenge","action"]),title:z.string().trim().min(1).max(180)}).strict(),
 z.object({action:z.literal("source"),projectId:governanceId,channelClientId:governanceId,sourceApp:z.enum(["gca","fs"]),sourceAuthority:z.string().min(1).max(180),externalUnitId:z.string().min(1).max(180),issuer:z.string().url().max(300),rpAudience:z.string().min(1).max(180),verifierUserId:governanceId}).strict(),
 z.object({action:z.literal("binding"),sourceId:governanceId,userId:governanceId,ruleVersionId:governanceId,subject:z.string().min(1).max(300),sourceRecordId:z.string().min(1).max(180),verificationRef:z.string().min(1).max(180)}).strict(),
 z.object({action:z.literal("rule"),projectId:governanceId,version:z.number().int().min(1),condition:GovernanceConditionSchema,rewards:GovernanceRewardsSchema,validFrom:z.string().datetime(),validUntil:z.string().datetime()}).strict(),
 z.object({action:z.literal("transition"),projectId:governanceId,ruleVersionId:governanceId.optional(),transition:z.enum(["approve","publish","retire"])}).strict(),
 z.object({action:z.literal("qualify"),event:GovernanceQualificationSchema}).strict(),
 z.object({action:z.literal("process"),projectId:governanceId,taskId:governanceId}).strict(),
 z.object({action:z.literal("visibility"),grantId:governanceId,publicVisible:z.boolean()}).strict(),
 z.object({action:z.literal("retry"),projectId:governanceId,taskId:governanceId}).strict(),
]);
export type GovernanceCommand=z.infer<typeof GovernanceCommandSchema>;
