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
};

const COLS: Record<SectionKey, ColDef[]> = {
  saas: [
    { key: "project", label: "Project", className: "min-w-[200px]" },
    { key: "stage", label: "Stage", kind: "select", options: ["Active", "Pending", "Blocked", "Done"] },
    { key: "deadline", label: "Deadline", kind: "date" },
    { key: "followUpDate", label: "Follow-Up", kind: "date" },
    { key: "clientContact", label: "Contact" },
    { key: "priority", label: "Priority", kind: "select", options: ["High", "Medium", "Low"] },
    { key: "notes", label: "Notes", kind: "textarea", className: "min-w-[240px]" },
  ],
  animals: [
    { key: "animalId", label: "Animal ID" },
    { key: "species", label: "Species" },
    { key: "stage", label: "Stage", kind: "select", options: ["Active", "Pending", "Blocked", "Done"] },
    { key: "buyer", label: "Buyer" },
    { key: "saleDate", label: "Sale Date", kind: "date" },
    { key: "notes", label: "Notes", kind: "textarea", className: "min-w-[240px]" },
  ],
  content: [
    { key: "task", label: "Task", className: "min-w-[200px]" },
    { key: "type", label: "Type" },
    { key: "deadline", label: "Deadline", kind: "date" },
    { key: "status", label: "Status" },
    { key: "platform", label: "Platform" },
    { key: "notes", label: "Notes", kind: "textarea", className: "min-w-[240px]" },
  ],
  personal: [
    { key: "task", label: "Task", className: "min-w-[200px]" },
    { key: "category", label: "Category" },
    { key: "deadline", label: "Deadline", kind: "date" },
    { key: "status", label: "Status" },
    { key: "notes", label: "Notes", kind: "textarea", className: "min-w-[240px]" },
  ],
};

const BLANK: Record<SectionKey, () => any> = {
  saas: () => ({ id: rid(), project: "", stage: "Active", deadline: "", followUpDate: "", clientContact: "", priority: "Medium", notes: "" }),
  animals: () => ({ id: rid(), animalId: "", species: "", stage: "Active", buyer: "", saleDate: "", notes: "" }),
  content: () => ({ id: rid(), task: "", type: "", deadline: "", status: "", platform: "", notes: "" }),
  personal: () => ({ id: rid(), task: "", category: "", deadline: "", status: "", notes: "" }),
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
  const fileRef = useRef<HTMLInputElement>(null);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const da = a.deadline || a.saleDate || "9999-99-99";
      const db = b.deadline || b.saleDate || "9999-99-99";
      return da.localeCompare(db);
    });
  }, [rows]);

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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={add} className="tab-btn active">+ Add row</button>
        <button onClick={download} className="tab-btn">Export CSV</button>
        <button onClick={() => fileRef.current?.click()} className="tab-btn">Import CSV</button>
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
        <span className="text-muted text-xs ml-auto">{rows.length} row{rows.length === 1 ? "" : "s"}</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-panel">
        <table className="grid">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key} className={c.className}>{c.label}</th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={cols.length + 1} className="text-center text-muted py-6">
                  No rows yet — add one, or import a CSV.
                </td>
              </tr>
            )}
            {sorted.map((row) => (
              <tr key={row.id}>
                {cols.map((c) => (
                  <td key={c.key} className={c.className}>
                    <Cell col={c} value={row[c.key] ?? ""} onChange={(v) => update(row.id, c.key, v)} />
                    {c.kind === "date" && row[c.key] && (
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
                    title="Delete row"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
          <option key={o} value={o} className="bg-panel">{o}</option>
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
