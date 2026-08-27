import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

// Deliberately a separate secret from AUTH_SECRET (which signs sessions):
// if one leaks, the other stays safe. Required, no fallback - refusing to
// silently reuse AUTH_SECRET keeps this from ever being an accidental
// afterthought as the app grows (see README on the multi-user tradeoff).
function getKey(): Buffer {
  const secret = process.env.MCP_MASTER_KEY;
  if (!secret) throw new Error("MCP_MASTER_KEY must be set (generate with: openssl rand -base64 32)");
  return scryptSync(secret, "mail-mcp-account-encryption", 32);
}

/** Returns "iv:authTag:ciphertext", all hex-encoded. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptSecret(encoded: string): string {
  const [ivHex, authTagHex, ciphertextHex] = encoded.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Malformed encrypted value");
  }
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plain = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, "hex")), decipher.final()]);
  return plain.toString("utf8");
}
