import { PolicyPage } from "@/components/PolicyPage";

export default function TermsPage() {
  return (
    <PolicyPage title="Terms of Use">
      <p>Administrators and users must not upload illegal, harmful, infringing, or unauthorized content.</p>
      <p>M41NITOR should not be treated as the only backup. Telegram limits, account availability, bot behavior, and platform rules may change.</p>
      <p>The server requires temporary disk capacity while processing uploads even though files are not retained permanently on local disk.</p>
    </PolicyPage>
  );
}
