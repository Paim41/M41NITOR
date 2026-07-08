import { PolicyPage } from "@/components/PolicyPage";

export default function DeleteMyDataPage() {
  return (
    <PolicyPage title="Delete My Data">
      <p>In this first version, one administrator controls all records. The administrator can move files to Trash, restore them, or permanently delete them with filename confirmation.</p>
      <p>Permanent deletion removes metadata and attempts to delete the Telegram message. If the Telegram message was already removed manually, M41NITOR records the availability issue and completes metadata cleanup.</p>
    </PolicyPage>
  );
}
