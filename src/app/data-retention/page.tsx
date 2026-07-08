import { PolicyPage } from "@/components/PolicyPage";

export default function DataRetentionPage() {
  return (
    <PolicyPage title="Data Retention Policy">
      <p>Soft-deleted files remain in Trash and keep their Telegram messages until an administrator permanently deletes them.</p>
      <p>Permanent deletion attempts to delete the Telegram message and then removes the metadata record, while retaining only audit information needed for operational accountability.</p>
      <p>Files may become unavailable if the Telegram account, bot, group, channel, or message is deleted outside M41NITOR.</p>
    </PolicyPage>
  );
}
