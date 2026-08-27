import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import type { Provider } from "@auth/core/providers";
import { z } from "zod";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { authConfig } from "@/lib/auth/auth.config";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getUserByEmail, verifyPassword } from "@/lib/user/user";
import { prisma } from "@/lib/db/prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Google/GitHub are optional: this is a self-hosted app and not every
// deployment will configure OAuth apps for them. Only register a provider
// when both its client id/secret are present, rather than crashing at
// startup or registering a broken provider.
const providers: Provider[] = [
  Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Mot de passe", type: "password" },
    },
    authorize: async (rawCredentials, request) => {
      const parsed = credentialsSchema.safeParse(rawCredentials);
      if (!parsed.success) return null;

      const { email, password } = parsed.data;

      const ip = getClientIp(request.headers);
      const ipOk = checkRateLimit(`login:ip:${ip}`, 20, 15 * 60 * 1000);
      const emailOk = checkRateLimit(`login:email:${email}`, 8, 15 * 60 * 1000);
      if (!ipOk || !emailOk) return null;

      // Identity is fully decoupled from any mailbox now: this only ever
      // compares against passwordHash (bcrypt), never an IMAP password.
      const user = await getUserByEmail(email);
      if (!user || !user.passwordHash) return null;

      // Credentials signup requires email verification before first login
      // (see lib/actions/signup.ts / verify-email.ts). OAuth providers
      // don't need this - Google/GitHub already vouch for the email.
      if (!user.emailVerified) return null;

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) return null;

      return { id: user.id, email: user.email, name: user.name ?? undefined };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // See the signIn callback below: sign-in via Google is only ever a
      // second login method for a User that already exists (created
      // through the invite-gated credentials signup) - it never creates a
      // brand new identity. Google having already verified the email makes
      // auto-linking to a matching existing User safe here, unlike the
      // general case this flag is named after.
      allowDangerousEmailAccountLinking: true,
    })
  );
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers,
  callbacks: {
    ...authConfig.callbacks,
    /**
     * This app is closed-signup (invite-gated, no open public
     * registration - see the Invite model). The Credentials provider
     * already only ever authenticates a User created through
     * /signup?token=..., but the Prisma adapter would otherwise happily
     * auto-create a brand new User for *any* Google/GitHub account on
     * first sign-in, which would silently reopen public signup through the
     * back door. So: OAuth sign-in is only ever allowed as an *additional*
     * login method for a User that already exists by email; a never-seen
     * email is rejected outright, before the adapter gets a chance to
     * create anything (returning false/a string here happens before
     * adapter.createUser is invoked).
     */
    signIn: async ({ user, account }) => {
      if (!account || account.provider === "credentials") return true;
      if (!user.email) return false;

      const existing = await prisma.user.findUnique({ where: { email: user.email } });
      if (!existing) return false;

      // Google/GitHub already verified this email; if the account was
      // created via credentials signup but never confirmed its
      // verification email, a successful OAuth login is at least as strong
      // a proof - unblock credentials login too instead of leaving it
      // stuck.
      if (!existing.emailVerified) {
        await prisma.user.update({ where: { id: existing.id }, data: { emailVerified: new Date() } });
      }

      return true;
    },
  },
});
