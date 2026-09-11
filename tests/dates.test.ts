import { describe, expect, it } from "vitest";
import { addDays, bucketFor, bucketLabel, daysUntil, todayIso } from "@/lib/os/dates";

describe("todayIso", () => {
  it("formats in local time, not UTC", () => {
    // 11pm local on the 10th is already the 11th in UTC. The tracker's "due
    // today" must follow the phone's calendar, not the server's.
    const late = new Date(2026, 8, 10, 23, 30, 0);
    expect(todayIso(late)).toBe("2026-09-10");
  });

  it("zero-pads month and day", () => {
    expect(todayIso(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("addDays", () => {
  it("crosses month boundaries", () => {
    expect(addDays("2026-01-30", 3)).toBe("2026-02-02");
  });

  it("crosses year boundaries", () => {
    expect(addDays("2026-12-30", 5)).toBe("2027-01-04");
  });

  it("handles leap days", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  });

  it("subtracts with a negative count", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("returns the input unchanged when it is not a date", () => {
    expect(addDays("", 3)).toBe("");
    expect(addDays("nonsense", 3)).toBe("nonsense");
  });
});

describe("daysUntil", () => {
  const now = new Date(2026, 8, 11, 9, 0, 0);

  it("is 0 for today and negative for the past", () => {
    expect(daysUntil("2026-09-11", now)).toBe(0);
    expect(daysUntil("2026-09-10", now)).toBe(-1);
    expect(daysUntil("2026-09-13", now)).toBe(2);
  });

  it("returns null for empty or invalid input", () => {
    expect(daysUntil("", now)).toBeNull();
    expect(daysUntil("not-a-date", now)).toBeNull();
  });

  it("ignores the time of day", () => {
    const lateEvening = new Date(2026, 8, 11, 23, 59, 0);
    expect(daysUntil("2026-09-12", lateEvening)).toBe(1);
  });
});

describe("bucketFor / bucketLabel", () => {
  const now = new Date(2026, 8, 11, 12, 0, 0);

  it("classifies relative to today", () => {
    expect(bucketFor("2026-09-09", now)).toBe("overdue");
    expect(bucketFor("2026-09-11", now)).toBe("soon");
    expect(bucketFor("2026-09-12", now)).toBe("soon");
    expect(bucketFor("2026-09-20", now)).toBe("later");
    expect(bucketFor("", now)).toBe("none");
  });

  it("labels in plain language", () => {
    expect(bucketLabel("2026-09-11", now)).toBe("today");
    expect(bucketLabel("2026-09-12", now)).toBe("tomorrow");
    expect(bucketLabel("2026-09-08", now)).toBe("3d late");
    expect(bucketLabel("2026-09-16", now)).toBe("in 5d");
    expect(bucketLabel("", now)).toBe("");
  });
});
