"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/actions/session";
import { regenerateUserMcpToken } from "@/lib/user/user";

/** Regenerates the current account's static MCP token - one per account, see User.mcpToken in schema.prisma. */
export async function regenerateMcpToken(): Promise<string> {
  const user = await requireUser();
  const value = await regenerateUserMcpToken(user.id);
  revalidatePath("/settings", "layout");
  return value;
}
