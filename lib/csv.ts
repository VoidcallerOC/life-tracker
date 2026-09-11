import type { Store, SectionKey } from "./types";
import { rid } from "./store";

type RowMap = Record<string, string>;

function escape(cell: unknown): string {
  const s = cell == null ? "" : String(cell);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(headers: string[], rows: Record<string, unknown>[]): string {
  const head = headers.join(",");
  const body = rows.map((r) => headers.map((h) => escape(r[h])).join(",")).join("\n");
  return head + "\n" + body;
}

export function parseCSV(text: string): RowMap[] {
  const lines: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { cur.push(field); field = ""; }
      else if (c === '\n') { cur.push(field); lines.push(cur); cur = []; field = ""; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); lines.push(cur); }
  if (lines.length === 0) return [];
  const headers = lines[0].map((h) => h.trim());
  return lines.slice(1)
    .filter((row) => row.some((v) => v && v.trim() !== ""))
    .map((row) => {
      const rec: RowMap = {};
      headers.forEach((h, i) => { rec[h] = (row[i] ?? "").trim(); });
      return rec;
    });
}

export const HEADERS: Record<SectionKey, string[]> = {
  animals: ["Name", "Species", "Enclosure", "Last Fed", "Last Cleaned", "Next Care Due", "Notes"],
  content: ["Task", "Type", "Deadline", "Status", "Platform", "Notes"],
  personal: ["Task", "Category", "Deadline", "Status", "Notes"],
};

export function exportSection(section: SectionKey, store: Store): string {
  const headers = HEADERS[section];
  const rows = store[section].map((r) => rowToCsv(section, r));
  return toCSV(headers, rows);
}

function rowToCsv(section: SectionKey, r: any): Record<string, unknown> {
  switch (section) {
    case "animals":
      return {
        "Name": r.name,
        "Species": r.species,
        "Enclosure": r.enclosure,
        "Last Fed": r.lastFed,
        "Last Cleaned": r.lastCleaned,
        "Next Care Due": r.nextCareDue,
        "Notes": r.notes,
      };
    case "content":
      return { "Task": r.task, "Type": r.type, "Deadline": r.deadline, "Status": r.status, "Platform": r.platform, "Notes": r.notes };
    case "personal":
      return { "Task": r.task, "Category": r.category, "Deadline": r.deadline, "Status": r.status, "Notes": r.notes };
  }
}

export function importSection(section: SectionKey, text: string): any[] {
  const rows = parseCSV(text);
  switch (section) {
    case "animals":
      return rows.map((r) => ({
        id: rid(),
        name: r["Name"] ?? "",
        species: r["Species"] ?? "",
        enclosure: r["Enclosure"] ?? "",
        lastFed: normalizeDate(r["Last Fed"]),
        lastCleaned: normalizeDate(r["Last Cleaned"]),
        nextCareDue: normalizeDate(r["Next Care Due"]),
        notes: r["Notes"] ?? "",
      }));
    case "content":
      return rows.map((r) => ({
        id: rid(),
        task: r["Task"] ?? "",
        type: r["Type"] ?? "",
        deadline: normalizeDate(r["Deadline"]),
        status: r["Status"] ?? "",
        platform: r["Platform"] ?? "",
        notes: r["Notes"] ?? "",
      }));
    case "personal":
      return rows.map((r) => ({
        id: rid(),
        task: r["Task"] ?? "",
        category: r["Category"] ?? "",
        deadline: normalizeDate(r["Deadline"]),
        status: r["Status"] ?? "",
        notes: r["Notes"] ?? "",
      }));
  }
}

function normalizeDate(v: string | undefined): string {
  if (!v) return "";
  const s = v.trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const [_, mo, da, yr] = m;
    const year = yr.length === 2 ? `20${yr}` : yr;
    return `${year}-${mo.padStart(2, "0")}-${da.padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return "";
}
