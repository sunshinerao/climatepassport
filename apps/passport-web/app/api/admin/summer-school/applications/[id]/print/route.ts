import { NextResponse } from "next/server";
import { requireRoleAccess } from "@/lib/server/auth";
import { getPrismaClient } from "@/lib/server/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escape(s: unknown): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function row(label: string, value: unknown) {
  const v = value == null || value === "" ? "—" : String(value);
  return `<tr><td class="lbl">${escape(label)}</td><td>${escape(v)}</td></tr>`;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const url = new URL(request.url);
  const locale = (url.searchParams.get("locale") ?? "en") as "zh" | "en";
  const isZh = locale === "zh";

  await requireRoleAccess(locale, ["ADMIN"], `/${locale}/admin`);

  const prisma = getPrismaClient();
  if (!prisma) {
    return new NextResponse("Database unavailable.", { status: 503 });
  }

  const app = await prisma.summerSchoolApplication.findUnique({
    where: { id: params.id },
  });

  if (!app) {
    return new NextResponse("Not found.", { status: 404 });
  }

  const answers = (app.answersJson ?? {}) as Record<string, unknown>;

  const submittedAt = app.submittedAt
    ? new Date(app.submittedAt).toLocaleString(isZh ? "zh-CN" : "en-US")
    : "—";

  const sectionHead = (title: string) =>
    `<tr><th colspan="2" class="section-head">${escape(title)}</th></tr>`;

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width"/>
<title>${isZh ? "夏校申请表" : "Summer School Application"} — ${escape(app.fullName)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:11pt;color:#111;padding:20mm 18mm;background:#fff}
  h1{font-size:16pt;font-weight:700;margin-bottom:4px}
  .subtitle{font-size:10pt;color:#555;margin-bottom:16px}
  .meta{font-size:9pt;color:#666;margin-bottom:20px;border-bottom:1px solid #ddd;padding-bottom:10px}
  table{width:100%;border-collapse:collapse;margin-bottom:24px}
  td,th{padding:5px 8px;border:1px solid #ddd;vertical-align:top;font-size:10pt}
  td.lbl{width:38%;font-weight:600;background:#f7f7f7;white-space:nowrap}
  th.section-head{background:#1a3a2a;color:#fff;font-size:10pt;font-weight:700;text-align:left;letter-spacing:.04em;padding:6px 8px}
  .passport-id{font-family:monospace;background:#f0f0f0;padding:2px 6px;border-radius:3px;font-size:10pt}
  @media print{
    body{padding:12mm 14mm}
    @page{size:A4;margin:10mm}
  }
</style>
</head>
<body>
<h1>${isZh ? "GCA × 云谷 2026 可持续夏校 — 申请表" : "GCA × Yungu 2026 Sustainability Summer School — Application"}</h1>
<div class="subtitle">${isZh ? "夏校申请档案（仅供内部使用）" : "Application record — internal use only"}</div>
<div class="meta">
  <strong>Climate Passport ID:</strong>
  <span class="passport-id">${escape(app.climatePassportId)}</span>
  &nbsp;|&nbsp;
  <strong>${isZh ? "提交时间" : "Submitted"}:</strong> ${submittedAt}
  &nbsp;|&nbsp;
  <strong>${isZh ? "状态" : "Status"}:</strong> ${escape(app.applicationStatus ?? "—")}
</div>

<table>
  ${sectionHead(isZh ? "基础信息" : "Basic Information")}
  ${row(isZh ? "全名（拼音/英文）" : "Full name", app.fullName)}
  ${row(isZh ? "偏好称呼" : "Preferred name", app.preferredName)}
  ${row(isZh ? "出生日期" : "Date of birth", answers["dob"])}
  ${row(isZh ? "国籍" : "Nationality", answers["nationality"])}
  ${row(isZh ? "就读学校" : "School", answers["school"])}
  ${row(isZh ? "年级" : "Grade", answers["grade"])}
  ${row(isZh ? "申请人邮箱" : "Applicant email", app.email)}
  ${row(isZh ? "申请人手机" : "Applicant phone", app.phone)}
</table>

<table>
  ${sectionHead(isZh ? "监护人信息" : "Guardian Information")}
  ${row(isZh ? "监护人姓名" : "Guardian name", app.guardianName)}
  ${row(isZh ? "监护人邮箱" : "Guardian email", app.guardianEmail)}
  ${row(isZh ? "监护人手机" : "Guardian phone", app.guardianPhone)}
  ${row(isZh ? "了解渠道" : "Referral channel", app.channel)}
</table>

<table>
  ${sectionHead(isZh ? "气候关切" : "Climate Concern")}
  ${row(isZh ? "探索阶段" : "Exploration stage", answers["explorationStage"])}
  ${row(isZh ? "核心气候关切" : "Core climate issue", answers["coreIssue"])}
  ${row(isZh ? "实践证明" : "Practice proof", answers["practiceProof"])}
  ${row(isZh ? "作品集链接" : "Portfolio URL", answers["portfolioUrl"])}
</table>

<table>
  ${sectionHead(isZh ? "AI 协作" : "AI Collaboration")}
  ${row(isZh ? "AI 角色" : "AI role", answers["aiRole"])}
  ${row(isZh ? "使用的 AI 工具" : "AI tools used", answers["aiTools"])}
  ${row(isZh ? "AI 盲区思考" : "AI blind spot", answers["aiBlindspot"])}
</table>

<table>
  ${sectionHead(isZh ? "愿景与后勤" : "Vision & Logistics")}
  ${row(isZh ? "夏校期望" : "Expectations", answers["expectation"])}
  ${row(isZh ? "未来参与方向" : "Future paths", Array.isArray(answers["futurePath"]) ? (answers["futurePath"] as string[]).join(", ") : answers["futurePath"])}
  ${row(isZh ? "语言适应度" : "Language comfort", answers["languageComfort"])}
  ${row(isZh ? "行程承诺" : "Travel commitment", answers["travelCommitment"])}
</table>

<script>window.onload=()=>window.print();</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
