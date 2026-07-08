import { env, requireEnv } from "./env";

type TelegramResult<T> = { ok: true; result: T } | { ok: false; description: string; error_code?: number };

type MessageDocument = {
  message_id: number;
  document?: { file_id: string; file_unique_id: string };
  photo?: { file_id: string; file_unique_id: string }[];
  video?: { file_id: string; file_unique_id: string };
  audio?: { file_id: string; file_unique_id: string };
};

type GetFileResult = { file_id: string; file_unique_id: string; file_path?: string; file_size?: number };

function apiRoot() {
  return env.TELEGRAM_API_BASE_URL.replace(/\/$/, "");
}

function botUrl(method: string) {
  return `${apiRoot()}/bot${requireEnv("TELEGRAM_BOT_TOKEN")}/${method}`;
}

async function telegram<T>(method: string, init?: RequestInit) {
  const response = await fetch(botUrl(method), { ...init, cache: "no-store" });
  const data = (await response.json()) as TelegramResult<T>;
  if (!response.ok || !data.ok) {
    throw new Error(data.ok ? `Telegram ${method} failed` : data.description);
  }
  return data.result;
}

export async function uploadTelegramDocument(input: {
  chatId: string;
  buffer: Buffer;
  filename: string;
  mimeType: string;
  caption?: string;
}) {
  const form = new FormData();
  form.append("chat_id", input.chatId);
  if (input.caption) form.append("caption", input.caption.slice(0, 1024));
  const arrayBuffer = input.buffer.buffer.slice(input.buffer.byteOffset, input.buffer.byteOffset + input.buffer.byteLength) as ArrayBuffer;
  form.append("document", new Blob([new Uint8Array(arrayBuffer)], { type: input.mimeType }), input.filename);
  const message = await telegram<MessageDocument>("sendDocument", { method: "POST", body: form });
  return {
    messageId: message.message_id,
    fileId: message.document?.file_id,
    uniqueFileId: message.document?.file_unique_id,
    mediaType: "document",
  };
}

export async function getTelegramFile(fileId: string) {
  return telegram<GetFileResult>("getFile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
  });
}

export async function downloadTelegramFile(fileId: string) {
  const file = await getTelegramFile(fileId);
  if (!file.file_path) throw new Error("Telegram did not return a file path");
  const token = requireEnv("TELEGRAM_BOT_TOKEN");
  const response = await fetch(`${apiRoot()}/file/bot${token}/${file.file_path}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Telegram file download failed");
  return Buffer.from(await response.arrayBuffer());
}

export async function deleteTelegramMessage(chatId: string, messageId: number) {
  return telegram<boolean>("deleteMessage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
  });
}

export async function testTelegramDestination(chatId: string) {
  const started = Date.now();
  try {
    const me = await telegram<{ id: number; username?: string }>("getMe");
    const chat = await telegram<{ id: number | string; title?: string; type: string }>("getChat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId }),
    });
    return {
      ok: true,
      bot: me.username ?? String(me.id),
      chatTitle: chat.title ?? String(chat.id),
      reachableMs: Date.now() - started,
      canPost: "verify by test upload",
      canDelete: "verify by deleting uploaded messages",
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Telegram check failed" };
  }
}
