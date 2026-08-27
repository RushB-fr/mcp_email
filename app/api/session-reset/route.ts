import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/http";

/**
 * Clears a stale session cookie (its account was deleted after the cookie
 * was issued) and sends the user back to /login. A Server Component can't
 * mutate cookies, hence this dedicated Route Handler - see
 * lib/actions/session.ts's requireUser().
 *
 * Deliberately uses getAppBaseUrl() rather than the raw request URL: behind
 * Traefik, req.url reflects the container's internal bind address
 * (0.0.0.0:3000, see Dockerfile), not the public domain.
 */
export async function GET() {
  const response = NextResponse.redirect(`${await getAppBaseUrl()}/login`);
  // response.cookies.delete(name) alone doesn't set the "Secure" attribute.
  // Browsers hard-reject any Set-Cookie for a "__Secure-"-prefixed name that
  // lacks it, silently discarding the whole header - so the deletion never
  // actually took effect, leaving the stale cookie in place and causing a
  // redirect loop (session-reset -> login -> still "logged in" -> settings
  // -> session-reset again). Setting it explicitly here fixes that.
  const expired = { path: "/", expires: new Date(0) };
  response.cookies.set("authjs.session-token", "", expired);
  response.cookies.set("__Secure-authjs.session-token", "", { ...expired, secure: true });
  return response;
}
