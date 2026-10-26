import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const INFO = "dashboard:oauth-token-encryption:v1";
const PREFIX = "v1:";

/** 32-byte key from TOKEN_ENCRYPTION_KEY, falling back to SESSION_SECRET (HKDF-SHA256, fixed label). */
export function deriveKey(env: Record<string, string | undefined> = process.env): Buffer {
  const secret = env.TOKEN_ENCRYPTION_KEY || env.SESSION_SECRET;
  if (!secret) throw new Error("Thiếu TOKEN_ENCRYPTION_KEY hoặc SESSION_SECRET");
  return Buffer.from(hkdfSync("sha256", secret, "", INFO, 32));
}

/** AES-256-GCM; output "v1:" + base64url(iv | tag | ciphertext). */
export function encrypt(plain: string, key: Buffer = deriveKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64url");
}

/** Throws if the payload was tampered with or the key is wrong. */
export function decrypt(payload: string, key: Buffer = deriveKey()): string {
  if (!payload.startsWith(PREFIX)) throw new Error("Định dạng mã hóa không hợp lệ");
  const raw = Buffer.from(payload.slice(PREFIX.length), "base64url");
  if (raw.length < 29) throw new Error("Dữ liệu mã hóa quá ngắn");
  const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}
