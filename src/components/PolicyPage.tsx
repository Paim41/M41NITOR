import Link from "next/link";

export function PolicyPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#000000] px-6 py-10 text-[#EEEEEE]">
      <div className="mx-auto max-w-3xl border border-white/15 bg-[#000000]">
        <div className="border-b border-white/15 p-6">
          <Link href="/" className="text-sm font-semibold tracking-wide text-[#EEEEEE] hover:text-[#DDDDDD]">M41NITOR</Link>
          <h1 className="mt-4 text-3xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-[#DDDDDD]">Telegram-backed expandable storage</p>
        </div>
        <div className="space-y-5 p-6 text-sm leading-7 text-[#DDDDDD]">{children}</div>
      </div>
    </main>
  );
}
