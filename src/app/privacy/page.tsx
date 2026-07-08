import { PolicyPage } from "@/components/PolicyPage";

export default function PrivacyPage() {
  return (
    <PolicyPage title="Privacy Policy">
      <p>M41NITOR transfers uploaded files to administrator-configured private Telegram chats. Telegram is an external platform and is the content backend for file bytes.</p>
      <p>The application database stores searchable metadata such as filenames, MIME types, checksums, tags, descriptions, Telegram message references, and audit events. It does not intentionally store complete uploaded files permanently on the application server.</p>
      <p>Bot tokens, chat IDs, database credentials, administrator passwords, session cookies, and encryption keys are never sent to frontend code.</p>
    </PolicyPage>
  );
}
