import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const isProd = process.env.NODE_ENV === "production";

export function middleware(request: NextRequest) {
  const incomingRequestId = request.headers.get("x-request-id");
  const isValidRequestId =
    incomingRequestId && /^[a-zA-Z0-9._-]{1,64}$/.test(incomingRequestId);

  const requestId = isValidRequestId ? incomingRequestId : crypto.randomUUID();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Always return X-Request-Id to the client
  response.headers.set("X-Request-Id", requestId);

  // Security Headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );

  // HSTS — only in production (HTTPS only)
  if (isProd) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }

  // Content Security Policy
  // production: no unsafe-eval; unsafe-inline only for style (Next.js inline CSS unavoidable)
  const scriptSrc = isProd
    ? `script-src 'self' 'unsafe-inline'`
    : `script-src 'self' 'unsafe-eval' 'unsafe-inline'`;

  const cspHeader = `
    default-src 'self';
    ${scriptSrc};
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https:;
    font-src 'self';
    connect-src 'self' https://bandelbanget.xyz;
    frame-ancestors 'none';
    form-action 'self';
    base-uri 'self';
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  response.headers.set("Content-Security-Policy", cspHeader);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
