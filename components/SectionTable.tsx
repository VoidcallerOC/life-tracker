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
  // CSS grid track size for the desktop view. Dates need enough room for
  // the native mm/dd/yyyy widget; notes gets more relative space.
  width?: string;
};

const TEXT_WIDTH = "minmax(110px, 1fr)";
const DATE_WIDTH = "minmax(150px, 1fr)";
const NOTES_WIDTH = "minmax(220px, 2fr)";
const PRIMARY_WIDTH = "minmax(160px, 1.4fr)";
const DELETE_WIDTH = "2.25rem";

const COLS: Record<SectionKey, ColDef[]> = {
  animals: [
    { key: "name", label: "Name", primary: true, width: PRIMARY_WIDTH },
    { key: "species", label: "Species", width: TEXT_WIDTH },
    { key: "enclosure", label: "Enclosure", width: TEXT_WIDTH },
    { key: "lastFed", label: "Last Fed", kind: "date", width: DATE_WIDTH },
    { key: "lastCleaned", label: "Last Cleaned", kind: "date", width: DATE_WIDTH },
    { key: "nextCareDue", label: "Next Care Due", kind: "date", width: DATE_WIDTH },
    { key: "notes", label: "Notes", kind: "textarea", className: "min-w-[240px]", width: NOTES_WIDTH },
  ],
  content: [
    { key: "task", label: "Task", primary: true, width: PRIMARY_WIDTH },
    { key: "type", label: "Type", width: TEXT_WIDTH },
    { key: "deadline", label: "Deadline", kind: "date", width: DATE_WIDTH },
    { key: "status", label: "Status", width: TEXT_WIDTH },
    { key: "platform", label: "Platform", width: TEXT_WIDTH },
    { key: "notes", label: "Notes", kind: "textarea", className: "min-w-[240px]", width: NOTES_WIDTH },
  ],
  personal: [
    { key: "task", label: "Task", primary: true, width: PRIMARY_WIDTH },
    { key: "category", label: "Category", width: TEXT_WIDTH },
    { key: "deadline", label: "Deadline", kind: "date", width: DATE_WIDTH },
    { key: "status", label: "Status", width: TEXT_WIDTH },
    { key: "notes", label: "Notes", kind: "textarea", className: "min-w-[240px]", width: NOTES_WIDTH },
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
// fields (e.g. Last Fed, Last Cleaned) are history, not deadlines.
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
  const gridTemplateColumns = `${cols.map((c) => c.width ?? TEXT_WIDTH).join(" ")} ${DELETE_WIDTH}`;

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

          {/* Desktop: CSS grid, not a <table>. Header cells and data cells
              are direct children of the same grid (row wrappers use
              display:contents), so they always share identical column
              tracks — a plain <table> lets width:100% form controls throw
              off the browser's auto column sizing relative to the header
              text, which is what caused headers to drift out of alignment
              with their inputs. */}
          <div
            className="hidden md:grid overflow-x-auto rounded-lg border border-border bg-panel text-sm"
            style={{ gridTemplateColumns }}
          >
            {cols.map((c) => (
              <div
                key={c.key}
                className="text-left text-xs uppercase tracking-wide text-muted font-medium px-2 py-2 border-b border-border sticky top-0 bg-panel z-10"
              >
                {c.label}
              </div>
            ))}
            <div className="border-b border-border sticky top-0 bg-panel z-10" />

            {sorted.map((row) => (
              <div key={row.id} className="contents group">
                {cols.map((c) => (
                  <div
                    key={c.key}
                    className="align-top px-1 py-1 border-b border-border/60 group-hover:bg-white/[0.02]"
                  >
                    <Cell col={c} value={row[c.key] ?? ""} onChange={(v) => update(row.id, c.key, v)} />
                    {c.key === sortKey && row[c.key] && (
                      <div className="mt-1 pl-2">
                        <DeadlineTag date={row[c.key]} />
                      </div>
                    )}
                  </div>
                ))}
                <div className="px-1 py-1 border-b border-border/60 group-hover:bg-white/[0.02]">
                  <button
                    onClick={() => remove(row.id)}
                    className="text-muted hover:text-overdue px-1"
                    title={`Delete this ${noun}`}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
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
