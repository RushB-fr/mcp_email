"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/actions/session";
import { getLocale, getDictionary } from "@/lib/i18n/locale";

type AuthorizeParams = {
  clientId: string;
  redirectUri: string;
  state?: string;
  codeChallenge: string;
  codeChallengeMethod: string;
};

export async function approveAuthorization(params: AuthorizeParams) {
  const user = await requireUser();

  const client = await prisma.oAuthClient.findUnique({ where: { id: params.clientId } });
  if (!client || !client.redirectUris.includes(params.redirectUri)) {
    const dict = getDictionary(await getLocale());
    throw new Error(dict.oauth.errors.invalidClient);
  }

  const code = randomBytes(32).toString("base64url");
  await prisma.oAuthAuthorizationCode.create({
    data: {
      code,
      clientId: client.id,
      userId: user.id,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      codeChallengeMethod: params.codeChallengeMethod,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  const url = new URL(params.redirectUri);
  url.searchParams.set("code", code);
  if (params.state) url.searchParams.set("state", params.state);

  redirect(url.toString());
}

export async function denyAuthorization(params: { redirectUri: string; state?: string }) {
  const url = new URL(params.redirectUri);
  url.searchParams.set("error", "access_denied");
  if (params.state) url.searchParams.set("state", params.state);

  redirect(url.toString());
}

export async function revokeOAuthConnection(clientId: string) {
  const user = await requireUser();

  await prisma.oAuthRefreshToken.deleteMany({ where: { clientId, userId: user.id } });

  revalidatePath("/settings", "layout");
}
