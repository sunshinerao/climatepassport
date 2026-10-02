import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import { buildLoginPath, getDashboardPathForRole, getCurrentUser, type AuthenticatedUser } from "@/lib/server/auth";

// The guards this replaces hardcoded "en" at every call site, so redirects keep that target.
const REDIRECT_LOCALE = "en";

/**
 * API-only counterpart of requireAuthenticatedUser/requireRoleAccess. Those helpers
 * redirect to a login page, which makes an unauthenticated JSON call come back as
 * "307 -> login HTML" instead of a status the fetch() caller can branch on.
 *
 * Callers must check the failure branch:
 *   const user = await requireApiRole(["ADMIN"], request);
 *   if (user instanceof NextResponse) return user;
 *
 * Pass `request` so that endpoints the browser opens as a top-level navigation
 * (downloads, print views, <a href> links) keep redirecting instead of showing a raw
 * JSON body in the tab. fetch() callers are unaffected.
 */
function isTopLevelNavigation(request?: Request) {
  return request?.headers.get("sec-fetch-mode") === "navigate";
}

export function apiUnauthorized(request?: Request): NextResponse {
  if (request && isTopLevelNavigation(request)) {
    const url = new URL(request.url);
    return NextResponse.redirect(
      new URL(buildLoginPath(REDIRECT_LOCALE, `${url.pathname}${url.search}`), request.url),
      307,
    );
  }
  return NextResponse.json({ error: "Authentication required." }, { status: 401 });
}

export function apiForbidden(request?: Request, role: UserRole = "ATTENDEE"): NextResponse {
  if (request && isTopLevelNavigation(request)) {
    return NextResponse.redirect(new URL(getDashboardPathForRole(REDIRECT_LOCALE, role), request.url), 307);
  }
  return NextResponse.json({ error: "Forbidden." }, { status: 403 });
}

export async function requireApiUser(request?: Request): Promise<AuthenticatedUser | NextResponse> {
  const user = await getCurrentUser();
  return user ?? apiUnauthorized(request);
}

export async function requireApiRole(roles: UserRole[], request?: Request): Promise<AuthenticatedUser | NextResponse> {
  const user = await requireApiUser(request);
  if (user instanceof NextResponse) return user;
  return roles.includes(user.role) ? user : apiForbidden(request, user.role);
}
