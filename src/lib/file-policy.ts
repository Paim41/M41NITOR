import { fileTypeFromBuffer } from "file-type";
import type { FileCategory } from "./types";

const imageMimes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml", "image/bmp", "image/tiff"]);
const videoMimes = new Set(["video/mp4", "video/quicktime", "video/x-matroska", "video/webm", "video/x-msvideo", "video/mpeg"]);
const audioMimes = new Set(["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/aac", "audio/flac", "audio/ogg"]);
const documentMimes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/rtf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv",
]);
const archiveMimes = new Set(["application/zip", "application/vnd.rar", "application/x-7z-compressed", "application/x-tar", "application/gzip"]);

const dangerousExtensions = new Set(["exe", "msi", "bat", "cmd", "com", "scr", "dll", "ps1", "sh", "jar"]);
const dangerousMimes = new Set([
  "application/x-msdownload",
  "application/x-ms-installer",
  "application/x-bat",
  "application/x-sh",
  "application/java-archive",
]);

const extensionToMime: Record<string, string> = {
  svg: "image/svg+xml",
  txt: "text/plain",
  csv: "text/csv",
  rtf: "application/rtf",
  mkv: "video/x-matroska",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
};

export function sanitizeFilename(name: string) {
  return name
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180) || "upload.bin";
}

export function extensionFor(name: string) {
  const clean = sanitizeFilename(name);
  const idx = clean.lastIndexOf(".");
  return idx > -1 ? clean.slice(idx + 1).toLowerCase() : "";
}

export function classifyMime(mime: string): FileCategory {
  if (imageMimes.has(mime)) return "image";
  if (videoMimes.has(mime)) return "video";
  if (audioMimes.has(mime)) return "audio";
  if (documentMimes.has(mime)) return "document";
  if (archiveMimes.has(mime)) return "archive";
  return "other";
}

function isSvg(buffer: Buffer) {
  const head = buffer.subarray(0, 512).toString("utf8").toLowerCase();
  return head.includes("<svg") && !head.includes("<script");
}

export async function inspectUpload(buffer: Buffer, originalName: string, browserMime: string | null | undefined) {
  const cleanName = sanitizeFilename(originalName);
  const extension = extensionFor(cleanName);
  const detected = await fileTypeFromBuffer(buffer);
  let mimeType = detected?.mime ?? extensionToMime[extension] ?? browserMime ?? "application/octet-stream";
  if (extension === "svg") {
    if (!isSvg(buffer)) {
      throw new Error("SVG contains script-like content or is not a valid SVG preview candidate");
    }
    mimeType = "image/svg+xml";
  }
  if (dangerousExtensions.has(extension) || dangerousMimes.has(mimeType)) {
    throw new Error("Executable or dangerous file type blocked by policy");
  }
  return {
    originalName: cleanName,
    displayName: cleanName,
    extension,
    mimeType,
    category: classifyMime(mimeType),
  };
}

export function isPreviewSafe(mimeType: string) {
  return (
    mimeType.startsWith("image/") && mimeType !== "image/svg+xml" ||
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/") ||
    mimeType.startsWith("audio/") ||
    ["video/mp4", "video/webm", "video/ogg"].includes(mimeType)
  );
}
