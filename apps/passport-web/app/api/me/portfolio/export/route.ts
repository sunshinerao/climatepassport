import { NextResponse } from "next/server";
import { derivePortfolio } from "@/lib/server/portfolio";
import { getRequestAuditContext, writeCoreAuditLog } from "@/lib/server/audit";
import { requireApiUser } from "@/lib/server/api-auth";
export async function GET(request: Request) { const user = await requireApiUser(request); if (user instanceof NextResponse) return user; const portfolio = await derivePortfolio(user.id, "en"); await writeCoreAuditLog({ actorUserId: user.id, action: "PORTFOLIO_EXPORTED", subjectType: "Portfolio", subjectId: user.id, result: "SUCCESS", ...getRequestAuditContext(request) }); return NextResponse.json(portfolio, { headers: { "Content-Disposition": "attachment; filename=verified-portfolio.json" } }); }
