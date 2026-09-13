import { getCurrentUser } from "@/lib/auth/current-user";
import LogoutButton from "@/components/LogoutButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--panel-bg)" }}>
      <header className="deck-panel flex items-center justify-between px-4 py-3 sticky top-0 z-10">
        <div>
          <div className="text-[var(--amber)] font-semibold tracking-wide text-lg leading-none">SQUAWK KING IA</div>
          <div className="readout-mono text-[10px] text-[var(--text-dim)] mt-0.5">
            {user?.name} · {user?.role.toUpperCase()}
          </div>
        </div>
        <nav className="flex items-center gap-4 readout-mono text-xs">
          <a href="/dashboard" className="text-[var(--text-dim)] hover:text-[var(--amber)]">DIAGNOSE</a>
          <a href="/logbook" className="text-[var(--text-dim)] hover:text-[var(--amber)]">LOGBOOK</a>
          <LogoutButton />
        </nav>
      </header>
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
