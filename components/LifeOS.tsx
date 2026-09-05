"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SectionKey, Store } from "@/lib/types";
import type { Client } from "@/lib/clients/types";
import { LEGACY_LOCAL_STORAGE_KEY, SECTION_LABEL, isEmptyStore } from "@/lib/store";
import { saveStore, resetStoreAction } from "@/app/actions/lifeStore";
import { Dashboard } from "@/components/Dashboard";
import { SectionTable } from "@/components/SectionTable";
import { ForgeSummary } from "@/components/ForgeSummary";
import { logoutAction } from "@/app/login/actions";

const SAVE_DEBOUNCE_MS = 800;

type Tab = "dashboard" | "clients" | SectionKey;

const TABS: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "clients", label: "Forge" },
  { key: "animals", label: SECTION_LABEL.animals },
  { key: "content", label: SECTION_LABEL.content },
  { key: "personal", label: SECTION_LABEL.personal },
];

export function LifeOS({
  initialClients,
  initialStore,
}: {
  initialClients: Client[];
  initialStore: Store;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [store, setStore] = useState<Store>(initialStore);
  const skipNextSave = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // One-time migration: Animals/Content/Personal used to live only in this
  // browser's localStorage. If the server has nothing yet but this browser
  // does, push that data up so it becomes the synced copy everywhere.
  useEffect(() => {
    if (!isEmptyStore(initialStore)) return;
    try {
      const raw = window.localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Store>;
      const migrated: Store = {
        animals: parsed.animals ?? [],
        content: parsed.content ?? [],
        personal: parsed.personal ?? [],
      };
      if (isEmptyStore(migrated)) return;
      setStore(migrated);
      saveStore(migrated);
      window.localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEY);
    } catch {
      // Corrupt legacy data — nothing to migrate.
    }
    // Only ever run once, right after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveStore(store);
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [store]);

  function resetAll() {
    if (!confirm("Clear Animals, Content, and Personal data? This can't be undone. Forge clients are not affected.")) return;
    skipNextSave.current = true;
    resetStoreAction().then(setStore);
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
            <p className="text-muted text-sm mt-0.5">Everything here is synced and shared across devices.</p>
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
              title="Wipe Animals, Content, and Personal data. Forge clients are not affected."
            >
              Reset data
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
