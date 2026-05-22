import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Injects x-pathname into request headers so server components can read
 * the current route path (e.g. to render minimal shells for specific pages).
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: new Headers({
        ...Object.fromEntries(request.headers),
        "x-pathname": request.nextUrl.pathname,
      }),
    },
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
