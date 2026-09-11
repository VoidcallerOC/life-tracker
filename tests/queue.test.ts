import { describe, expect, it } from "vitest";
import { buildQueue, countOverdue, laterTasks } from "@/lib/os/queue";
import type { Animal, Client, Task } from "@/lib/os/types";
import { emptyAnimal, emptyClient, emptyTask } from "@/lib/os/types";

const NOW = new Date(2026, 8, 11, 9, 0, 0); // Friday 2026-09-11
const TODAY = "2026-09-11";

function client(overrides: Partial<Client>): Client {
  return { ...emptyClient(), id: "c1", name: "Shop", ...overrides };
}
function animal(overrides: Partial<Animal>): Animal {
  return { ...emptyAnimal(), id: "a1", name: "Ziggy", ...overrides };
}
function task(overrides: Partial<Task>): Task {
  return { ...emptyTask("personal"), id: "t1", title: "Thing", ...overrides };
}

describe("buildQueue — animals", () => {
  it("surfaces care due today and overdue, but not next week", () => {
    const animals = [
      animal({ id: "due", nextCareDue: TODAY }),
      animal({ id: "late", nextCareDue: "2026-09-08" }),
      animal({ id: "later", nextCareDue: "2026-09-20" }),
    ];
    const ids = buildQueue([], animals, [], NOW).map((i) => i.sourceId);
    expect(ids).toContain("due");
    expect(ids).toContain("late");
    expect(ids).not.toContain("later");
  });

  it("ranks overdue animal care above everything else", () => {
    const queue = buildQueue(
      [client({ id: "c1", status: "Pending", nextAction: "" })],
      [animal({ id: "late", nextCareDue: "2026-09-01" })],
      [task({ id: "t1", deadline: "2026-09-09" })],
      NOW,
    );
    expect(queue[0].sourceId).toBe("late");
  });

  it("respects a snooze that has not elapsed", () => {
    const snoozed = animal({ nextCareDue: TODAY, snoozeUntil: "2026-09-20" });
    expect(buildQueue([], [snoozed], [], NOW)).toHaveLength(0);
  });

  it("returns once a snooze has passed", () => {
    const expired = animal({ nextCareDue: TODAY, snoozeUntil: "2026-09-10" });
    expect(buildQueue([], [expired], [], NOW)).toHaveLength(1);
  });

  it("skips animals with no due date at all", () => {
    expect(buildQueue([], [animal({ nextCareDue: "" })], [], NOW)).toHaveLength(0);
  });
});

describe("buildQueue — tasks", () => {
  it("includes tasks due today and tomorrow only", () => {
    const tasks = [
      task({ id: "today", deadline: TODAY }),
      task({ id: "tomorrow", deadline: "2026-09-12" }),
      task({ id: "later", deadline: "2026-09-30" }),
      task({ id: "none", deadline: "" }),
    ];
    const ids = buildQueue([], [], tasks, NOW).map((i) => i.sourceId);
    expect(ids).toEqual(expect.arrayContaining(["today", "tomorrow"]));
    expect(ids).not.toContain("later");
    expect(ids).not.toContain("none");
  });

  it("excludes completed tasks", () => {
    const done = task({ deadline: TODAY, status: "Done" });
    expect(buildQueue([], [], [done], NOW)).toHaveLength(0);
  });
});

describe("buildQueue — clients", () => {
  it("flags a Pending client with no next action", () => {
    const queue = buildQueue([client({ status: "Pending", nextAction: "" })], [], [], NOW);
    expect(queue[0].kind).toBe("client-missing-next");
  });

  it("does not flag a Potential client for a missing next action", () => {
    const queue = buildQueue([client({ status: "Potential", nextAction: "" })], [], [], NOW);
    expect(queue).toHaveLength(0);
  });

  it("never surfaces a Lost client", () => {
    const lost = client({ status: "Lost", nextAction: "", lastContacted: "2026-01-01" });
    expect(buildQueue([lost], [], [], NOW)).toHaveLength(0);
  });

  it("flags a contacted client gone stale past the threshold", () => {
    const stale = client({
      status: "Pending",
      nextAction: "Follow up",
      contacted: true,
      lastContacted: "2026-08-20",
    });
    expect(buildQueue([stale], [], [], NOW)[0].kind).toBe("client-stale");
  });

  it("does not call a Paid client stale", () => {
    const paid = client({
      status: "Paid",
      nextAction: "Care plan",
      contacted: true,
      lastContacted: "2026-01-01",
    });
    const kinds = buildQueue([paid], [], [], NOW).map((i) => i.kind);
    expect(kinds).not.toContain("client-stale");
  });

  it("prefers the missing-next-action warning over staleness", () => {
    const both = client({
      status: "Pending",
      nextAction: "",
      contacted: true,
      lastContacted: "2026-01-01",
    });
    const queue = buildQueue([both], [], [], NOW);
    expect(queue).toHaveLength(1);
    expect(queue[0].kind).toBe("client-missing-next");
  });
});

describe("countOverdue", () => {
  it("counts only items already past their date", () => {
    const queue = buildQueue(
      [],
      [animal({ id: "late", nextCareDue: "2026-09-01" }), animal({ id: "today", nextCareDue: TODAY })],
      [],
      NOW,
    );
    expect(countOverdue(queue, NOW)).toBe(1);
  });
});

describe("laterTasks", () => {
  it("holds back what is not due yet and excludes finished work", () => {
    const tasks = [
      task({ id: "later", deadline: "2026-10-01" }),
      task({ id: "undated", deadline: "" }),
      task({ id: "soon", deadline: TODAY }),
      task({ id: "done", deadline: "2026-10-01", status: "Done" }),
    ];
    const ids = laterTasks(tasks, NOW).map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(["later", "undated"]));
    expect(ids).not.toContain("soon");
    expect(ids).not.toContain("done");
  });

  it("keeps a snoozed task in Later even when its date has passed", () => {
    const snoozed = task({ id: "snoozed", deadline: "2026-09-01", snoozeUntil: "2026-09-20" });
    expect(laterTasks([snoozed], NOW).map((t) => t.id)).toContain("snoozed");
  });
});
