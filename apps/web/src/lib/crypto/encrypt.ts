/**
 * Field-Level AES-256-GCM Encryption
 *
 * Encrypts sensitive data (tokens, credentials) before persisting.
 * Uses ENCRYPTION_KEY env var (64-char hex = 32 bytes).
 * Falls back to plaintext with a warning if no key is configured.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SEPARATOR = ":";

function getKey(): Buffer | null {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) return null;
  if (hex.length !== 64) {
    console.warn(
      "[encrypt] ENCRYPTION_KEY must be 64 hex characters (32 bytes). Falling back to plaintext."
    );
    return null;
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns base64-encoded "iv:ciphertext:authTag".
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  if (!key) {
    console.warn("[encrypt] No ENCRYPTION_KEY set — storing plaintext.");
    return plaintext;
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const combined = [
    iv.toString("base64"),
    encrypted.toString("base64"),
    authTag.toString("base64"),
  ].join(SEPARATOR);

  return combined;
}

/**
 * Decrypt a string produced by encrypt().
 * Parses "iv:ciphertext:authTag" (each segment base64).
 */
export function decrypt(encrypted: string): string {
  const key = getKey();
  if (!key) {
    // If no key, we stored plaintext — return as-is
    return encrypted;
  }

  const parts = encrypted.split(SEPARATOR);
  if (parts.length !== 3) {
    // Not encrypted — return as-is (graceful migration)
    return encrypted;
  }

  const iv = Buffer.from(parts[0], "base64");
  const ciphertext = Buffer.from(parts[1], "base64");
  const authTag = Buffer.from(parts[2], "base64");

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    // Doesn't look like our format — return as-is
    return encrypted;
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * JSON-serialize then encrypt.
 */
export function encryptJson(data: unknown): string {
  return encrypt(JSON.stringify(data));
}

/**
 * Decrypt then JSON-parse.
 */
export function decryptJson<T = unknown>(encrypted: string): T {
  return JSON.parse(decrypt(encrypted)) as T;
}
