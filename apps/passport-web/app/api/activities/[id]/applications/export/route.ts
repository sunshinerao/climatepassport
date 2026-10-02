import { NextRequest, NextResponse } from "next/server";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { getPrismaClient } from "@/lib/server/prisma";
import { canManageActivity } from "@/lib/server/verifier-activity";
import { requireApiRole } from "@/lib/server/api-auth";

const applicationStatuses = new Set([
  "DRAFT", "SUBMITTED", "UNDER_REVIEW", "INTERVIEW", "APPROVED", "REJECTED", "OFFERED", "WAITLISTED", "CANCELLED", "WITHDRAWN",
]);

function escapeCsv(value: unknown): string {
  let text = String(value ?? "");
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN", "EVENT_MANAGER"], req);
  if (auth instanceof NextResponse) return auth;

  const prisma = getPrismaClient();
  if (!prisma) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const activity = await prisma.activity.findUnique({
    where: { id: params.id },
    select: { id: true, type: true, title: true, slug: true },
  });
  if (!activity) return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  if (!(await canManageActivity(prisma, auth, activity.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = new URL(req.url).searchParams.get("status");
  if (status && !applicationStatuses.has(status)) {
    return NextResponse.json({ error: "Invalid application status." }, { status: 400 });
  }

  const applications = await prisma.activityApplication.findMany({
    where: { activityId: activity.id, ...(status ? { status: status as any } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      projectConsent: { select: { shareName: true, shareEmail: true } },
    },
  });

  const headers = ["Name", "Email", "Role Type", "Status", "Submitted At", "Reviewed At"];
  const rows = applications.map((application) => {
    const project = activity.type === "PROJECT";
    return [
      !project || application.projectConsent?.shareName ? application.user.name : "",
      !project || application.projectConsent?.shareEmail ? application.user.email : "",
      application.roleType ?? "",
      application.status,
      application.submittedAt?.toISOString() ?? "",
      application.reviewedAt?.toISOString() ?? "",
    ];
  });
  const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n")}`;
  const date = new Date().toISOString().slice(0, 10);
  const asciiFilename = `activity-applications-${date}.csv`;
  const displayFilename = `${activity.slug || "activity"}-applications-${date}.csv`;

  await writeCoreAuditLog({
    actorUserId: auth.id,
    action: "ACTIVITY_APPLICATIONS_EXPORTED",
    subjectType: "Activity",
    subjectId: activity.id,
    result: "SUCCESS",
    metadataJson: { count: applications.length, status: status ?? "ALL", projectConsentApplied: activity.type === "PROJECT" },
    ...getRequestAuditContext(req),
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(displayFilename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
