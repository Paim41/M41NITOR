import { signValue, verifySignature } from "./crypto";

type DownloadPayload = {
  fileId: string;
  userId: string;
  exp: number;
  mode: "download" | "preview";
};

export function createDownloadToken(payload: DownloadPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signValue(encoded)}`;
}

export function verifyDownloadToken(token: string): DownloadPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || !verifySignature(encoded, signature)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as DownloadPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
