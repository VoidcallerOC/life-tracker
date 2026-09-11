import type { Animal, Client, Task } from "@/lib/os/types";

function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function yyyymmdd(date: string): string {
  return date.replaceAll("-", "");
}

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

type Event = { uid: string; date: string; title: string; desc: string };

export function lifeToIcs(clients: Client[], animals: Animal[], tasks: Task[]): string {
  const events: Event[] = [];
  for (const a of animals) {
    if (!a.nextCareDue) continue;
    events.push({
      uid: `animal-${a.id}@life-os`,
      date: a.nextCareDue,
      title: `Care: ${a.name || "Animal"}`,
      desc: [a.species, a.enclosure, a.notes].filter(Boolean).join(" — "),
    });
  }
  for (const t of tasks) {
    if (t.status === "Done" || !t.deadline) continue;
    events.push({
      uid: `task-${t.id}@life-os`,
      date: t.deadline,
      title: t.title,
      desc: [t.lane, t.platform || t.category, t.notes].filter(Boolean).join(" — "),
    });
  }
  for (const c of clients) {
    if (c.status === "Lost" || !c.dueDate) continue;
    events.push({
      uid: `client-${c.id}@life-os`,
      date: c.dueDate,
      title: c.name,
      desc: [c.status, c.nextAction, c.notes].filter(Boolean).join(" — "),
    });
  }

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Life OS//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Life OS",
  ];
  for (const ev of events) {
    const start = yyyymmdd(ev.date);
    if (start.length !== 8) continue;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${nextDay(ev.date)}`,
      `SUMMARY:${icsEscape(ev.title || "Untitled")}`,
      `DESCRIPTION:${icsEscape(ev.desc)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(filename: string, ics: string) {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
