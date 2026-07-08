import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { env, requireEnv } from "./env";

const algorithm = "aes-256-gcm";

export type EncryptedPayload = {
  data: Buffer;
  nonce: string;
  authTag: string;
  version: number;
};

export function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function encryptionKey() {
  const raw = requireEnv("FILE_ENCRYPTION_KEY");
  const key = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("FILE_ENCRYPTION_KEY must decode to 32 bytes for AES-256-GCM");
  }
  return key;
}

export function shouldEncryptFiles() {
  return env.FILE_ENCRYPTION_ENABLED === "true";
}

export function encryptBuffer(buffer: Buffer): EncryptedPayload {
  const nonce = randomBytes(12);
  const cipher = createCipheriv(algorithm, encryptionKey(), nonce);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return {
    data: encrypted,
    nonce: nonce.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    version: env.FILE_ENCRYPTION_KEY_VERSION,
  };
}

export function decryptBuffer(buffer: Buffer, nonce: string, authTag: string) {
  const decipher = createDecipheriv(algorithm, encryptionKey(), Buffer.from(nonce, "base64"));
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  return Buffer.concat([decipher.update(buffer), decipher.final()]);
}

function signingSecret() {
  return Buffer.from(requireEnv("SESSION_SECRET"));
}

export function signValue(payload: string) {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

export function verifySignature(payload: string, signature: string) {
  const expected = signValue(payload);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}
