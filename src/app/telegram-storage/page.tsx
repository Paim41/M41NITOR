import { PolicyPage } from "@/components/PolicyPage";

export default function TelegramStoragePage() {
  return (
    <PolicyPage title="Telegram Storage Explanation">
      <p>M41NITOR uses private Telegram channels or groups as the remote content backend. The local PostgreSQL database stores the searchable metadata and Telegram message references.</p>
      <p>Downloads are streamed through the backend using short-lived signed application URLs. Telegram bot tokens and raw Telegram file URLs are never exposed to the browser.</p>
      <p>For deployments using the cloud Bot API, configure and respect Telegram upload and download limits. Self-hosted Local Bot API deployments can set `TELEGRAM_API_BASE_URL`.</p>
    </PolicyPage>
  );
}
