"use client";

import { SheetFrame } from "@/components/os/sheet-frame";

const RULES = [
  "Do Now is the truth. If it is not on that list, it can wait.",
  "Living things go first. Feed before you pitch shops.",
  "Paid needs a real dollar amount. Zero does not count.",
  "Paid clients cannot be deleted. History stays.",
  "Lost needs a reason. You will not remember why in three months.",
  "Do not add a new shop while five sit uncalled.",
  "Every Pending or Paid client needs a next action. Blank is how jobs die.",
  "Leads are a parking lot. They are not today's work.",
  "There is always Undo. Use it.",
];

export function RulesSheet({ onClose }: { onClose: () => void }) {
  return (
    <SheetFrame title="Guardrails" subtitle="The app refuses to let you be clever. That is the point." onClose={onClose}>
      <ol className="space-y-3">
        {RULES.map((rule, i) => (
          <li key={rule} className="flex gap-3 text-sm text-fg">
            <span className="font-mono text-muted tabular-nums">{String(i + 1).padStart(2, "0")}</span>
            <span>{rule}</span>
          </li>
        ))}
      </ol>
    </SheetFrame>
  );
}
