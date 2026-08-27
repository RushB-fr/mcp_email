import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { getUserById } from "@/lib/user/user";
import type { User } from "@prisma/client";

/**
 * Resolves the logged-in identity (a User, not a mailbox - see
 * lib/mail/mailbox.ts for loading a specific Mailbox). Multi-tenant: the
 * session only carries a user id, so this always re-fetches the current row
 * rather than trusting anything cached in the JWT.
 *
 * If the session references a user that no longer exists (deleted after the
 * cookie was issued), the cookie is stale: redirect through
 * /api/session-reset to actually clear it (Server Components can't mutate
 * cookies) instead of crashing on a failed lookup.
 */
export async function requireUser(): Promise<User> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Non authentifié");
  }

  const user = await getUserById(session.user.id);
  if (!user) {
    redirect("/api/session-reset");
  }
  return user;
}
