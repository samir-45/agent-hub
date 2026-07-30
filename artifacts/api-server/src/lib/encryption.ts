import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function getKey(): Buffer {
  const secret = process.env.SESSION_SECRET || process.env.CLERK_SECRET_KEY || "cockpit-agent-hub-secure-encryption-secret-2026";
  // Derive a 32-byte key from the secret using SHA-256
  return createHash("sha256").update(secret).digest();
}

export function encrypt(plaintext: string): { encryptedValue: string; iv: string; authTag: string } {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encryptedValue: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

export function decrypt(encryptedValue: string, iv: string, authTag: string): string {
  const key = getKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(authTag, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return key.slice(0, 6) + "••••••••" + key.slice(-4);
}
