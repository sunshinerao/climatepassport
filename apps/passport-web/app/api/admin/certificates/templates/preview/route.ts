import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/server/auth";
import {
  buildCertificateVerificationQrSvg,
  parseCertificateRenderConfig,
  renderCertificateHtml,
} from "@/lib/server/certificate-module";

function sanitizeTemplatePreviewFileName(value: string) {
  return value
    .replace(/[\\/:*?"<>|#%{}\[\]^~`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const previewPayloadSchema = z.object({
  locale: z.enum(["zh", "en", "fr", "de"]).default("en"),
  name: z.string().trim().min(1).max(200).optional(),
  nameEn: z.string().trim().max(200).nullish(),
  categoryName: z.string().trim().max(200).nullish(),
  categoryNameEn: z.string().trim().max(200).nullish(),
  holderName: z.string().trim().max(120).nullish(),
  holderNameEn: z.string().trim().max(120).nullish(),
  issueDate: z.string().trim().max(40).nullish(),
  completionDate: z.string().trim().max(40).nullish(),
  certificateNumber: z.string().trim().max(80).nullish(),
  variableValues: z.record(z.string(), z.unknown()).optional(),
  renderConfig: z.unknown().optional(),
});

export async function POST(request: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  const payload = previewPayloadSchema.safeParse(await request.json().catch(() => ({})));
  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid preview payload." },
      { status: 400 },
    );
  }

  const locale = payload.data.locale;
  const certificateName = locale === "zh"
    ? payload.data.name ?? "证书模板预览"
    : payload.data.nameEn ?? payload.data.name ?? "Template Preview";
  const categoryName = locale === "zh"
    ? payload.data.categoryName ?? "证书分类"
    : payload.data.categoryNameEn ?? payload.data.categoryName ?? "Certificate Category";
  const documentTitle = sanitizeTemplatePreviewFileName(`${categoryName}-${certificateName}（模版）`) || "证书分类-模版名称（模版）";
  const previewVerificationUrl = new URL("/verify/certificate/CV-PREVIEW?preview=1", request.url).toString();
  const renderConfig = parseCertificateRenderConfig(payload.data.renderConfig);
  const verificationQrSvg = await buildCertificateVerificationQrSvg(
    previewVerificationUrl,
    renderConfig.accentColor ?? "#1f5a4e",
  );

  const html = renderCertificateHtml({
    holderName: payload.data.holderName ?? (locale === "zh" ? "证书持有人" : "Credential Holder"),
    certificateName,
    categoryName,
    issueDate: payload.data.issueDate ?? new Date().toISOString().slice(0, 10),
    certificateNumber: payload.data.certificateNumber ?? "CV-PREVIEW",
    documentTitle,
    verificationUrl: previewVerificationUrl,
    verificationQrSvg,
    variableValues: {
      holderNameEn: payload.data.holderNameEn ?? "Credential Holder",
      certificateNameEn: payload.data.nameEn ?? payload.data.name ?? "Template Preview",
      categoryNameEn: payload.data.categoryNameEn ?? payload.data.categoryName ?? "Certificate Category",
      workName: locale === "zh" ? "示例作品" : "Sample Work",
      workNameEn: "Sample Work",
      eventName: locale === "zh" ? "示例活动" : "Sample Event",
      eventNameEn: "Sample Event",
      projectName: locale === "zh" ? "示例项目" : "Sample Project",
      projectNameEn: "Sample Project",
      programName: locale === "zh" ? "示例计划" : "Sample Program",
      programNameEn: "Sample Program",
      courseName: locale === "zh" ? "示例课程" : "Sample Course",
      courseNameEn: "Sample Course",
      roleName: locale === "zh" ? "参与者" : "Participant",
      roleNameEn: "Participant",
      organizationName: locale === "zh" ? "气候护照平台" : "Climate Passport Platform",
      organizationNameEn: "Climate Passport Platform",
      institutionName: locale === "zh" ? "气候护照平台" : "Climate Passport Platform",
      institutionNameEn: "Climate Passport Platform",
      achievementName: locale === "zh" ? "阶段成就" : "Milestone Achievement",
      achievementNameEn: "Milestone Achievement",
      milestoneName: locale === "zh" ? "学习里程碑" : "Learning Milestone",
      milestoneNameEn: "Learning Milestone",
      sessionName: locale === "zh" ? "主会场" : "Main Session",
      sessionNameEn: "Main Session",
      topicName: locale === "zh" ? "可持续发展" : "Sustainability",
      topicNameEn: "Sustainability",
      trackName: locale === "zh" ? "蓝色经济" : "Blue Economy",
      trackNameEn: "Blue Economy",
      speakerName: locale === "zh" ? "示例讲者" : "Sample Speaker",
      speakerNameEn: "Sample Speaker",
      mentorName: locale === "zh" ? "示例导师" : "Sample Mentor",
      mentorNameEn: "Sample Mentor",
      cohortName: locale === "zh" ? "2026 春季班" : "Spring 2026 Cohort",
      cohortNameEn: "Spring 2026 Cohort",
      locationName: locale === "zh" ? "上海" : "Shanghai",
      locationNameEn: "Shanghai",
      completionDate: payload.data.completionDate ?? payload.data.issueDate ?? new Date().toISOString().slice(0, 10),
      signer: renderConfig.signerName ?? renderConfig.issuerName ?? (locale === "zh" ? "签发管理员" : "Issuing Officer"),
      learningHours: "24",
      capabilityTags: locale === "zh" ? ["系统思维", "气候沟通"] : ["Systems Thinking", "Climate Communication"],
      ...payload.data.variableValues,
    },
    renderConfig,
  });

  return NextResponse.json({ ok: true, html });
}
