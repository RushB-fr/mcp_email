import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

async function main() {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.invite.create({ data: { token, expiresAt } });

  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  console.log(`Invitation créée, valable jusqu'au ${expiresAt.toLocaleString("fr-FR")}.`);
  console.log(`${baseUrl}/signup?token=${token}`);
}

main()
  .catch((error) => {
    console.error("Échec de la création de l'invitation:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
