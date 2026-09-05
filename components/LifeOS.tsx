"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SectionKey, Store } from "@/lib/types";
import type { Client } from "@/lib/clients/types";
import { EMPTY, load, save, SECTION_LABEL, clearAll } from "@/lib/store";
import { Dashboard } from "@/components/Dashboard";
import { SectionTable } from "@/components/SectionTable";
import { ForgeSummary } from "@/components/ForgeSummary";
import { logoutAction } from "@/app/login/actions";

type Tab = "dashboard" | "clients" | SectionKey;

const TABS: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "clients", label: "Forge" },
  { key: "animals", label: SECTION_LABEL.animals },
  { key: "content", label: SECTION_LABEL.content },
  { key: "personal", label: SECTION_LABEL.personal },
];

export function LifeOS({ initialClients }: { initialClients: Client[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [store, setStore] = useState<Store>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setStore(load());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) save(store);
  }, [store, ready]);

  function resetAll() {
    if (!confirm("Clear Animals, Content, and Personal data saved on this device? This can't be undone. Forge clients are not affected.")) return;
    setStore(clearAll());
  }

  function jump(target: string) {
    if (target === "clients") {
      setTab("clients");
      return;
    }
    setTab(target as Tab);
  }

  return (
    <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-5">
      <header>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Life OS</h1>
            <p className="text-muted text-sm mt-0.5">
              Animals · Content · Personal are saved on this device. Forge is synced and shared.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs shrink-0">
            <form action={logoutAction}>
              <button type="submit" className="text-muted hover:text-text transition" title="Sign out">
                Log out
              </button>
            </form>
            <span className="text-border" aria-hidden>
              |
            </span>
            <button
              onClick={resetAll}
              className="text-overdue/80 hover:text-overdue transition"
              title="Wipe Animals, Content, and Personal data saved on this device. Forge clients are not affected."
            >
              Reset local data
            </button>
          </div>
        </div>

        <nav className="flex items-center gap-1.5 flex-wrap mt-4 pt-3 border-t border-border">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`tab-btn ${tab === t.key ? "active" : ""}`}
            >
              {t.label}
            </button>
          ))}
          <Link href="/clients" className="tab-btn">
            Full client list →
          </Link>
        </nav>
      </header>

      {tab === "dashboard" ? (
        <Dashboard store={store} clients={initialClients} onJump={jump} />
      ) : tab === "clients" ? (
        <ForgeSummary clients={initialClients} />
      ) : (
        <SectionTable
          section={tab as SectionKey}
          store={store}
          setStore={(u) => setStore((prev) => u(prev))}
        />
      )}
    </main>
  );
}
