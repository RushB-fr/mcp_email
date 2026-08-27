import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe base config (used by the proxy/middleware). Deliberately has no
 * providers or adapter here: Credentials pulls in bcryptjs/Prisma, and the
 * Prisma adapter itself needs a real Node runtime - neither must be bundled
 * into the Edge-safe auth instance. The full config with providers/adapter
 * lives in auth.ts and is only used in Node contexts (route handlers,
 * server actions).
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  trustHost: true,
  providers: [],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id as string;
        token.email = (user as { email: string }).email;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
      }
      return session;
    },
  },
};
