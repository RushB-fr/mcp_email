import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/auth.config";

/**
 * Edge-safe auth instance for the proxy: only checks the JWT session
 * cookie, never calls authorize(), so it never touches bcrypt/Prisma.
 */
export const { auth } = NextAuth(authConfig);
