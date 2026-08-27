import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

function isValidRedirectUri(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  if (!body || !Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0) {
    return NextResponse.json(
      { error: "invalid_client_metadata", error_description: "redirect_uris is required" },
      { status: 400 }
    );
  }

  if (!body.redirect_uris.every(isValidRedirectUri)) {
    return NextResponse.json(
      { error: "invalid_redirect_uri", error_description: "redirect_uris must be https (or localhost)" },
      { status: 400 }
    );
  }

  const tokenEndpointAuthMethod = body.token_endpoint_auth_method === "client_secret_post" ? "client_secret_post" : "none";
  const clientSecret = tokenEndpointAuthMethod === "client_secret_post" ? randomBytes(32).toString("base64url") : null;
  const clientName = typeof body.client_name === "string" ? body.client_name.slice(0, 200) : null;

  const client = await prisma.oAuthClient.create({
    data: {
      clientName,
      redirectUris: body.redirect_uris,
      tokenEndpointAuthMethod,
      clientSecret,
    },
  });

  return NextResponse.json(
    {
      client_id: client.id,
      client_secret: clientSecret ?? undefined,
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      redirect_uris: client.redirectUris,
      client_name: clientName ?? undefined,
      token_endpoint_auth_method: tokenEndpointAuthMethod,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    { status: 201 }
  );
}
