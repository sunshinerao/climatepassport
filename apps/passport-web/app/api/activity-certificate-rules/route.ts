import { NextResponse } from "next/server";

function canonicalUrl(request: Request) {
  const source = new URL(request.url);
  return new URL(`/api/admin/certificates/rules${source.search}`, source.origin);
}

export async function GET(request: Request) {
  return NextResponse.redirect(canonicalUrl(request), 307);
}

export async function POST(request: Request) {
  return NextResponse.redirect(canonicalUrl(request), 307);
}
