import { NextResponse } from "next/server";
function canonicalUrl(request: Request, activityId: string) {
  const source = new URL(request.url);
  const target = new URL("/api/admin/certificates/rules", source.origin);
  target.searchParams.set("activityId", activityId);
  return target;
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  return NextResponse.redirect(canonicalUrl(request, params.id), 307);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  return NextResponse.redirect(canonicalUrl(request, params.id), 307);
}
