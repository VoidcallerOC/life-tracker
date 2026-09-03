"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SectionKey, Store } from "@/lib/types";
import type { Client } from "@/lib/clients/types";
import { EMPTY, load, save, SECTION_LABEL, clearAll } from "@/lib/store";
import { Dashboard } from "@/components/Dashboard";
import { SectionTable } from "@/components/SectionTable";
import { FrontWindowSummary } from "@/components/FrontWindowSummary";
import { logoutAction } from "@/app/login/actions";

type Tab = "dashboard" | "clients" | SectionKey;

const TABS: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "clients", label: "Front Window" },
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
    if (!confirm("Clear ALL data? This can't be undone.")) return;
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
    <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <header className="flex items-center gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Life OS</h1>
          <p className="text-muted text-sm">
            Personal tracker · sections saved to this browser · Front Window synced server-side
          </p>
        </div>
        <nav className="flex items-center gap-1 flex-wrap ml-auto">
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
            Clients →
          </Link>
          <button
            onClick={resetAll}
            className="tab-btn text-overdue hover:text-overdue"
            title="Wipe localStorage data"
          >
            Reset
          </button>
          <form action={logoutAction}>
            <button type="submit" className="tab-btn" title="Sign out">
              Log out
            </button>
          </form>
        </nav>
      </header>

      {tab === "dashboard" ? (
        <Dashboard store={store} clients={initialClients} onJump={jump} />
      ) : tab === "clients" ? (
        <FrontWindowSummary clients={initialClients} />
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
