import { describe, expect, it } from "vitest";
import {
  addPotentialError,
  deleteClientError,
  lostReasonError,
  namesMatch,
  paidAmountError,
  pendingMissingNext,
  recomputeAnimalDue,
} from "@/lib/os/guardrails";
import { emptyAnimal, emptyClient, type Animal, type Client } from "@/lib/os/types";

function client(overrides: Partial<Client>): Client {
  return { ...emptyClient(), id: "c1", name: "Shop", ...overrides };
}
function animal(overrides: Partial<Animal>): Animal {
  return { ...emptyAnimal(), id: "a1", name: "Ziggy", ...overrides };
}

describe("recomputeAnimalDue", () => {
  it("takes the sooner of the next feed and the next clean", () => {
    const result = recomputeAnimalDue(
      animal({ lastFed: "2026-09-10", feedEveryDays: 2, lastCleaned: "2026-09-01", cleanEveryDays: 30 }),
      "2026-09-11",
    );
    expect(result.nextCareDue).toBe("2026-09-12");
  });

  it("uses the cleaning date when it falls first", () => {
    const result = recomputeAnimalDue(
      animal({ lastFed: "2026-09-10", feedEveryDays: 14, lastCleaned: "2026-09-10", cleanEveryDays: 2 }),
      "2026-09-11",
    );
    expect(result.nextCareDue).toBe("2026-09-12");
  });

  it("treats a never-fed animal as due today", () => {
    const result = recomputeAnimalDue(animal({ lastFed: "", lastCleaned: "" }), "2026-09-11");
    expect(result.nextCareDue).toBe("2026-09-11");
  });

  it("clamps a zero or negative interval to one day", () => {
    const result = recomputeAnimalDue(
      animal({ lastFed: "2026-09-10", feedEveryDays: 0, lastCleaned: "2026-09-10", cleanEveryDays: -5 }),
      "2026-09-11",
    );
    expect(result.feedEveryDays).toBeGreaterThanOrEqual(1);
    expect(result.cleanEveryDays).toBeGreaterThanOrEqual(1);
  });
});

describe("money and status guards", () => {
  it("rejects a Paid amount that is missing, zero, or negative", () => {
    expect(paidAmountError(null)).not.toBeNull();
    expect(paidAmountError(0)).not.toBeNull();
    expect(paidAmountError(-5)).not.toBeNull();
    expect(paidAmountError(Number.NaN)).not.toBeNull();
  });

  it("accepts a real amount", () => {
    expect(paidAmountError(275)).toBeNull();
  });

  it("requires a substantive Lost reason", () => {
    expect(lostReasonError("")).not.toBeNull();
    expect(lostReasonError("  ")).not.toBeNull();
    expect(lostReasonError("no")).not.toBeNull();
    expect(lostReasonError("went with a cousin")).toBeNull();
  });

  it("refuses to delete a Paid client", () => {
    expect(deleteClientError(client({ status: "Paid" }))).not.toBeNull();
    expect(deleteClientError(client({ status: "Potential" }))).toBeNull();
  });
});

describe("addPotentialError", () => {
  const uncalled = Array.from({ length: 5 }, (_, i) =>
    client({ id: `c${i}`, status: "Potential", contacted: false }),
  );

  it("blocks piling up more uncontacted leads", () => {
    expect(addPotentialError(uncalled, false)).not.toBeNull();
  });

  it("can be overridden deliberately", () => {
    expect(addPotentialError(uncalled, true)).toBeNull();
  });

  it("does not count leads already contacted", () => {
    const contacted = uncalled.map((c) => ({ ...c, contacted: true }));
    expect(addPotentialError(contacted, false)).toBeNull();
  });
});

describe("namesMatch", () => {
  it("ignores case and surrounding whitespace", () => {
    expect(namesMatch("  ziggy ", "Ziggy")).toBe(true);
    expect(namesMatch("zig", "Ziggy")).toBe(false);
  });
});

describe("pendingMissingNext", () => {
  it("finds Pending and Paid clients with a blank next action", () => {
    const clients = [
      client({ id: "a", status: "Pending", nextAction: "" }),
      client({ id: "b", status: "Paid", nextAction: "   " }),
      client({ id: "c", status: "Pending", nextAction: "Call" }),
      client({ id: "d", status: "Potential", nextAction: "" }),
    ];
    expect(pendingMissingNext(clients).map((c) => c.id)).toEqual(["a", "b"]);
  });
});
