import type { Store } from "@/lib/types";
import { rid } from "@/lib/store";

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Starter rows written once when Animals/Content/Personal are empty. */
export function starterStore(): Store {
  return {
    animals: [
      {
        id: rid(),
        name: "Add real animals",
        species: "Replace this row",
        enclosure: "",
        lastFed: "",
        lastCleaned: "",
        nextCareDue: todayPlus(0),
        notes: "Delete this placeholder after you add your actual animals.",
      },
    ],
    content: [
      {
        id: rid(),
        task: "Forge / Voidcaller post",
        type: "Social",
        deadline: todayPlus(2),
        status: "Todo",
        platform: "X",
        notes: "Swap this for a real piece of content.",
      },
    ],
    personal: [
      {
        id: rid(),
        task: "Review Forge pipeline + next actions",
        category: "Forge",
        deadline: todayPlus(1),
        status: "Todo",
        notes: "Open the Forge tab and put a next action on every Pending/Paid client.",
      },
    ],
  };
}
