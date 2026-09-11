import { describe, expect, it } from "vitest";
import {
  animalToRow,
  clientToRow,
  fromIsoDate,
  rowToAnimal,
  rowToClient,
  rowToTask,
  taskToRow,
  toIsoDate,
  type AnimalRecordRow,
  type ClientRow,
  type TaskRecordRow,
} from "@/lib/db/rows";
import { emptyAnimal, emptyClient, emptyTask, type Animal, type Client, type Task } from "@/lib/os/types";

describe("date column mapping", () => {
  it("renders a Date as a plain yyyy-mm-dd in UTC", () => {
    expect(toIsoDate(new Date(Date.UTC(2026, 8, 11)))).toBe("2026-09-11");
  });

  it("maps null to an empty string and back", () => {
    expect(toIsoDate(null)).toBe("");
    expect(fromIsoDate("")).toBeNull();
    expect(fromIsoDate(null)).toBeNull();
  });

  it("truncates a timestamp string to the date part", () => {
    expect(toIsoDate("2026-09-11T04:00:00.000Z")).toBe("2026-09-11");
  });
});

describe("client round-trip", () => {
  const original: Client = {
    ...emptyClient(),
    id: "c1",
    version: 7,
    name: "M&J",
    businessType: "retail",
    status: "Paid",
    contacted: true,
    phone: "555-0100",
    quoted: 500,
    deposit: null,
    paid: 275.5,
    paidDate: "2026-08-01",
    nextAction: "Care plan",
    dueDate: "2026-09-20",
    lastContacted: "2026-09-01",
    notes: "arcade themed",
    lostReason: "",
  };

  it("preserves every field through row and back", () => {
    const row = clientToRow(original);
    const roundTripped = rowToClient({ ...row, version: original.version } as unknown as ClientRow);
    expect(roundTripped).toEqual(original);
  });

  it("reads numeric columns that Postgres returns as strings", () => {
    const row = { ...clientToRow(original), quoted: "500.00", paid: "275.50", version: 7 };
    const result = rowToClient(row as unknown as ClientRow);
    expect(result.quoted).toBe(500);
    expect(result.paid).toBe(275.5);
  });

  it("keeps a null money column null rather than coercing to zero", () => {
    const row = { ...clientToRow(original), deposit: null, version: 1 };
    expect(rowToClient(row as unknown as ClientRow).deposit).toBeNull();
  });
});

describe("animal round-trip", () => {
  it("preserves fields and clamps intervals to at least one day", () => {
    const original: Animal = {
      ...emptyAnimal(),
      id: "a1",
      version: 3,
      name: "Ziggy",
      species: "leopard gecko",
      lastFed: "2026-09-10",
      lastCleaned: "2026-09-01",
      nextCareDue: "2026-09-12",
      feedEveryDays: 2,
      cleanEveryDays: 30,
    };
    const row = animalToRow(original);
    expect(rowToAnimal({ ...row, version: 3 } as unknown as AnimalRecordRow)).toEqual(original);

    const clamped = animalToRow({ ...original, feedEveryDays: 0 });
    expect(clamped.feed_every_days).toBe(1);
  });
});

describe("task round-trip", () => {
  it("preserves priority, which the previous JSON mapping dropped", () => {
    const original: Task = {
      ...emptyTask("content"),
      id: "t1",
      version: 2,
      title: "Post teaser",
      lane: "content",
      deadline: "2026-09-12",
      status: "Todo",
      priority: "High",
      platform: "X",
      category: "Social",
    };
    const row = taskToRow(original);
    const result = rowToTask({ ...row, version: 2 } as unknown as TaskRecordRow);
    expect(result).toEqual(original);
    expect(result.priority).toBe("High");
  });

  it("keeps lanes distinct", () => {
    const personal = taskToRow({ ...emptyTask("personal"), id: "t2", version: 0, title: "Dentist" });
    expect(personal.lane).toBe("personal");
  });
});
