import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD_HASH: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_API_BASE_URL: z.string().url().default("https://api.telegram.org"),
  TELEGRAM_PHOTO_CHAT_ID: z.string().optional(),
  TELEGRAM_VIDEO_CHAT_ID: z.string().optional(),
  TELEGRAM_AUDIO_CHAT_ID: z.string().optional(),
  TELEGRAM_DOCUMENT_CHAT_ID: z.string().optional(),
  TELEGRAM_ARCHIVE_CHAT_ID: z.string().optional(),
  TELEGRAM_OTHER_CHAT_ID: z.string().optional(),
  FILE_ENCRYPTION_ENABLED: z.string().default("false"),
  FILE_ENCRYPTION_KEY: z.string().optional(),
  FILE_ENCRYPTION_KEY_VERSION: z.coerce.number().default(1),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().positive().default(50),
  TEMP_UPLOAD_DIRECTORY: z.string().optional(),
  UPLOAD_RATE_LIMIT: z.coerce.number().positive().default(30),
  LOGIN_RATE_LIMIT: z.coerce.number().positive().default(5),
});

export const env = envSchema.parse(process.env);

export const isProduction = process.env.NODE_ENV === "production";

export function requireEnv(name: keyof typeof env): string {
  const value = env[name];
  if (!value || typeof value !== "string") {
    throw new Error(`${name} is required`);
  }
  return value;
}
