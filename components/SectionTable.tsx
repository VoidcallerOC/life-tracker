"use client";
import { useMemo, useRef } from "react";
import type { SectionKey, Store } from "@/lib/types";
import { rid } from "@/lib/store";
import { exportSection, importSection } from "@/lib/csv";
import { bucketFor, pillClass, bucketLabel, daysUntil } from "@/lib/deadlines";

type ColDef = {
  key: string;
  label: string;
  kind?: "text" | "date" | "select" | "textarea";
  options?: string[];
  className?: string;
  primary?: boolean;
};

const COLS: Record<SectionKey, ColDef[]> = {
  animals: [
    { key: "name", label: "Name", primary: true },
    { key: "species", label: "Species" },
    { key: "enclosure", label: "Enclosure" },
    { key: "lastFed", label: "Last Fed", kind: "date" },
    { key: "lastCleaned", label: "Last Cleaned", kind: "date" },
    { key: "nextCareDue", label: "Next Care Due", kind: "date" },
    { key: "notes", label: "Notes", kind: "textarea", className: "min-w-[240px]" },
  ],
  content: [
    { key: "task", label: "Task", className: "min-w-[200px]", primary: true },
    { key: "type", label: "Type" },
    { key: "deadline", label: "Deadline", kind: "date" },
    { key: "status", label: "Status" },
    { key: "platform", label: "Platform" },
    { key: "notes", label: "Notes", kind: "textarea", className: "min-w-[240px]" },
  ],
  personal: [
    { key: "task", label: "Task", className: "min-w-[200px]", primary: true },
    { key: "category", label: "Category" },
    { key: "deadline", label: "Deadline", kind: "date" },
    { key: "status", label: "Status" },
    { key: "notes", label: "Notes", kind: "textarea", className: "min-w-[240px]" },
  ],
};

const BLANK: Record<SectionKey, () => any> = {
  animals: () => ({
    id: rid(),
    name: "",
    species: "",
    enclosure: "",
    lastFed: "",
    lastCleaned: "",
    nextCareDue: "",
    notes: "",
  }),
  content: () => ({ id: rid(), task: "", type: "", deadline: "", status: "", platform: "", notes: "" }),
  personal: () => ({ id: rid(), task: "", category: "", deadline: "", status: "", notes: "" }),
};

// The one "real" forward-looking deadline per section — drives sort order
// and which date field gets the overdue/soon/later badge. Other date
// fields (e.g. Last Fed, Last Vet Visit) are history, not deadlines.
const SORT_KEY: Record<SectionKey, string> = {
  animals: "nextCareDue",
  content: "deadline",
  personal: "deadline",
};

const ITEM_NOUN: Record<SectionKey, string> = {
  animals: "animal",
  content: "content item",
  personal: "task",
};

export function SectionTable({
  section,
  store,
  setStore,
}: {
  section: SectionKey;
  store: Store;
  setStore: (updater: (s: Store) => Store) => void;
}) {
  const rows = store[section] as any[];
  const cols = COLS[section];
  const noun = ITEM_NOUN[section];
  const fileRef = useRef<HTMLInputElement>(null);

  const sortKey = SORT_KEY[section];

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const da = a[sortKey] || "9999-99-99";
      const db = b[sortKey] || "9999-99-99";
      return da.localeCompare(db);
    });
  }, [rows, sortKey]);

  function update(id: string, key: string, value: string) {
    setStore((s) => ({
      ...s,
      [section]: (s[section] as any[]).map((r) => (r.id === id ? { ...r, [key]: value } : r)),
    }));
  }

  function add() {
    setStore((s) => ({ ...s, [section]: [...(s[section] as any[]), BLANK[section]()] }));
  }

  function remove(id: string) {
    setStore((s) => ({ ...s, [section]: (s[section] as any[]).filter((r) => r.id !== id) }));
  }

  function download() {
    const csv = exportSection(section, store);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${section}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importFile(f: File) {
    const text = await f.text();
    const imported = importSection(section, text);
    setStore((s) => ({ ...s, [section]: [...(s[section] as any[]), ...imported] }));
  }

  const empty = sorted.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={add} className="tab-btn active">
          + Add {noun}
        </button>
        <button onClick={download} className="tab-btn">
          Export CSV
        </button>
        <button onClick={() => fileRef.current?.click()} className="tab-btn">
          Import CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importFile(f);
            e.currentTarget.value = "";
          }}
        />
        <span className="text-muted text-xs ml-auto">
          {rows.length} {noun}
          {rows.length === 1 ? "" : "s"}
        </span>
      </div>

      {empty ? (
        <div className="rounded-lg border border-dashed border-border bg-panel px-4 py-8 text-center text-sm text-muted">
          No {noun}s yet. Tap <span className="text-text">+ Add {noun}</span> above, or import a CSV.
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards, one per row */}
          <div className="md:hidden space-y-3">
            {sorted.map((row) => (
              <div key={row.id} className="rounded-lg border border-border bg-panel p-3 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-sm">
                    {row[cols.find((c) => c.primary)?.key ?? cols[0].key] || `Untitled ${noun}`}
                  </div>
                  <button
                    onClick={() => remove(row.id)}
                    className="text-muted hover:text-overdue px-1 -mt-1 -mr-1"
                    title={`Delete this ${noun}`}
                  >
                    ×
                  </button>
                </div>
                {cols.map((c) => (
                  <div key={c.key}>
                    <div className="text-[10px] uppercase tracking-wide text-muted mb-1">{c.label}</div>
                    <Cell col={c} value={row[c.key] ?? ""} onChange={(v) => update(row.id, c.key, v)} />
                    {c.key === sortKey && row[c.key] && (
                      <div className="mt-1">
                        <DeadlineTag date={row[c.key]} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-border bg-panel">
            <table className="grid">
              <thead>
                <tr>
                  {cols.map((c) => (
                    <th key={c.key} className={c.className}>
                      {c.label}
                    </th>
                  ))}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr key={row.id}>
                    {cols.map((c) => (
                      <td key={c.key} className={c.className}>
                        <Cell col={c} value={row[c.key] ?? ""} onChange={(v) => update(row.id, c.key, v)} />
                        {c.key === sortKey && row[c.key] && (
                          <div className="mt-1 pl-2">
                            <DeadlineTag date={row[c.key]} />
                          </div>
                        )}
                      </td>
                    ))}
                    <td>
                      <button
                        onClick={() => remove(row.id)}
                        className="text-muted hover:text-overdue px-2"
                        title={`Delete this ${noun}`}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function DeadlineTag({ date }: { date: string }) {
  const b = bucketFor(date);
  const d = daysUntil(date);
  if (b === "none") return null;
  return <span className={pillClass(b)}>{bucketLabel(b, d)}</span>;
}

function Cell({ col, value, onChange }: { col: ColDef; value: string; onChange: (v: string) => void }) {
  if (col.kind === "select") {
    return (
      <select className="cell-input" value={value} onChange={(e) => onChange(e.target.value)}>
        {col.options!.map((o) => (
          <option key={o} value={o} className="bg-panel">
            {o}
          </option>
        ))}
      </select>
    );
  }
  if (col.kind === "date") {
    return <input type="date" className="cell-input" value={value} onChange={(e) => onChange(e.target.value)} />;
  }
  if (col.kind === "textarea") {
    return <textarea rows={1} className="cell-input resize-y" value={value} onChange={(e) => onChange(e.target.value)} />;
  }
  return <input className="cell-input" value={value} onChange={(e) => onChange(e.target.value)} />;
}
