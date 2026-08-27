import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { ACCESS_TOKEN_TTL_SECONDS, issueAccessToken, issueRefreshToken } from "@/lib/oauth/tokens";

export const runtime = "nodejs";

async function tokenResponse(clientId: string, userId: string) {
  const refreshToken = await issueRefreshToken(clientId, userId);
  return NextResponse.json({
    access_token: issueAccessToken(clientId, userId),
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
  });
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  const form = contentType.includes("application/json") ? await jsonAsForm(req) : await req.formData();
  const grantType = form.get("grant_type");

  if (grantType === "authorization_code") {
    const code = form.get("code");
    const redirectUri = form.get("redirect_uri");
    const clientId = form.get("client_id");
    const codeVerifier = form.get("code_verifier");

    if (
      typeof code !== "string" ||
      typeof redirectUri !== "string" ||
      typeof clientId !== "string" ||
      typeof codeVerifier !== "string"
    ) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const authCode = await prisma.oAuthAuthorizationCode.findUnique({ where: { code } });
    if (
      !authCode ||
      authCode.clientId !== clientId ||
      authCode.redirectUri !== redirectUri ||
      authCode.expiresAt < new Date()
    ) {
      return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
    }

    // Only S256 is implemented - the authorize page already rejects any
    // other declared method before issuing a code, but this is re-checked
    // here defensively rather than assuming that always holds (e.g. a code
    // row created some other way, or that check ever regressing) and
    // silently hashing as if it were S256 regardless of what was recorded.
    if (authCode.codeChallengeMethod !== "S256") {
      return NextResponse.json(
        { error: "invalid_grant", error_description: "Unsupported code_challenge_method" },
        { status: 400 }
      );
    }

    const challenge = createHash("sha256").update(codeVerifier).digest("base64url");
    if (challenge !== authCode.codeChallenge) {
      return NextResponse.json(
        { error: "invalid_grant", error_description: "PKCE verification failed" },
        { status: 400 }
      );
    }

    await prisma.oAuthAuthorizationCode.delete({ where: { code } });

    return tokenResponse(clientId, authCode.userId);
  }

  if (grantType === "refresh_token") {
    const refreshToken = form.get("refresh_token");
    if (typeof refreshToken !== "string") {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const stored = await prisma.oAuthRefreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
    }

    await prisma.oAuthRefreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
    return tokenResponse(stored.clientId, stored.userId);
  }

  return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
}

async function jsonAsForm(req: Request): Promise<FormData> {
  const body = await req.json().catch(() => ({}));
  const form = new FormData();
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "string") form.set(key, value);
  }
  return form;
}
