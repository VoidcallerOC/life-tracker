"use client";
import { useEffect, useState } from "react";
import type { SectionKey, Store } from "@/lib/types";
import { EMPTY, load, save, SECTION_LABEL, clearAll } from "@/lib/store";
import { Dashboard } from "@/components/Dashboard";
import { SectionTable } from "@/components/SectionTable";

type Tab = "dashboard" | SectionKey;

const TABS: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "saas", label: SECTION_LABEL.saas },
  { key: "animals", label: SECTION_LABEL.animals },
  { key: "content", label: SECTION_LABEL.content },
  { key: "personal", label: SECTION_LABEL.personal },
];

export default function Page() {
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

  return (
    <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <header className="flex items-center gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Life OS</h1>
          <p className="text-muted text-sm">Personal tracker · saved to this browser</p>
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
          <button onClick={resetAll} className="tab-btn text-overdue hover:text-overdue" title="Wipe all data">
            Reset
          </button>
        </nav>
      </header>

      {tab === "dashboard" ? (
        <Dashboard store={store} onJump={(s) => setTab(s as Tab)} />
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
