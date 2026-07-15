import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { optionalEnv } from "@roadboard/config";

/**
 * AES-256-GCM symmetric encryption for at-rest secrets (per-user provider keys).
 * Key is derived (sha256 -> 32 bytes) from CRED_ENC_KEY, falling back to JWT_SECRET
 * so existing deployments work without a new env. Blob format: iv.tag.ciphertext (base64).
 * There is deliberately NO hardcoded fallback: encrypting under a publicly-known
 * constant would make every stored credential trivially decryptable.
 */
function key(): Buffer {
  const raw = optionalEnv("CRED_ENC_KEY", "") || optionalEnv("JWT_SECRET", "");

  if (!raw || raw === "change-me-in-production") {
    throw new Error(
      "CRED_ENC_KEY (or JWT_SECRET) must be set to a non-default value to encrypt/decrypt stored credentials",
    );
  }

  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export function decryptSecret(blob: string): string {
  const [ivb, tagb, encb] = blob.split(".");
  if (!ivb || !tagb || !encb) throw new Error("invalid secret blob");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivb, "base64"));
  decipher.setAuthTag(Buffer.from(tagb, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encb, "base64")), decipher.final()]).toString("utf8");
}
