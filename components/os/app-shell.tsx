"use client";

import { useMemo, useState } from "react";
import { Briefcase, CalendarDays, ListChecks, PawPrint, RotateCcw, Settings, Shield } from "lucide-react";
import { Toaster, toast } from "sonner";
import { DoNow } from "@/components/os/do-now";
import { ForgeView } from "@/components/os/forge-view";
import { AnimalsView } from "@/components/os/animals-view";
import { LaterView } from "@/components/os/later-view";
import { ClientSheet } from "@/components/os/client-sheet";
import { AnimalSheet } from "@/components/os/animal-sheet";
import { TaskSheet } from "@/components/os/task-sheet";
import { SettingsSheet } from "@/components/os/settings-sheet";
import { RulesSheet } from "@/components/os/rules-sheet";
import { ConfirmHost } from "@/components/os/confirm-gate";
import { Button } from "@/components/os/ui/button";
import { TodayLabel } from "@/components/os/today-label";
import { SyncIndicator } from "@/components/os/sync-indicator";
import { useLifeStore } from "@/lib/os/store";
import { buildQueue } from "@/lib/os/queue";
import { cn } from "@/lib/os/cn";

type Tab = "now" | "forge" | "animals" | "later";

export function AppShell() {
  const clients = useLifeStore((s) => s.clients);
  const animals = useLifeStore((s) => s.animals);
  const tasks = useLifeStore((s) => s.tasks);
  const undoStack = useLifeStore((s) => s.undoStack);
  const undo = useLifeStore((s) => s.undo);

  const [tab, setTab] = useState<Tab>("now");
  const [clientId, setClientId] = useState<string | null | undefined>(undefined);
  const [animalId, setAnimalId] = useState<string | null | undefined>(undefined);
  const [taskId, setTaskId] = useState<string | undefined>(undefined);
  const [taskLane, setTaskLane] = useState<"content" | "personal">("personal");
  const [settings, setSettings] = useState(false);
  const [rules, setRules] = useState(false);

  const queueCount = useMemo(
    () => buildQueue(clients, animals, tasks).length,
    [clients, animals, tasks],
  );

  const editingClient = clientId ? clients.find((c) => c.id === clientId) ?? null : clientId === null ? null : undefined;
  const editingAnimal = animalId ? animals.find((a) => a.id === animalId) ?? null : animalId === null ? null : undefined;
  const editingTask = taskId ? (tasks.find((t) => t.id === taskId) ?? null) : undefined;

  const tabs: { id: Tab; label: string; icon: typeof ListChecks; badge?: number }[] = [
    { id: "now", label: "Do Now", icon: ListChecks, badge: queueCount },
    { id: "forge", label: "Forge", icon: Briefcase },
    { id: "animals", label: "Animals", icon: PawPrint, badge: animals.length || undefined },
    { id: "later", label: "Later", icon: CalendarDays },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg text-fg">
      <header className="z-20 shrink-0 border-b border-border bg-bg px-4 py-2.5">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-fg">Life OS</h1>
            <p className="truncate text-sm text-muted">
              <TodayLabel
                suffix={queueCount > 0 ? ` · ${queueCount} in front of you` : " · board clear"}
              />
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <SyncIndicator />
            <Button
              variant="ghost"
              size="icon"
              disabled={undoStack.length === 0}
              aria-label="Undo"
              onClick={() => {
                const label = undo();
                if (label) toast(`Undid: ${label}`);
              }}
            >
              <RotateCcw className="size-5" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Guardrails" onClick={() => setRules(true)}>
              <Shield className="size-5" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Settings" onClick={() => setSettings(true)}>
              <Settings className="size-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto min-h-0 w-full max-w-2xl flex-1 overflow-y-auto px-4 py-3">
        {tab === "now" ? (
          <DoNow
            onOpenClient={(id) => setClientId(id)}
            onOpenTask={(id) => {
              const t = tasks.find((x) => x.id === id);
              setTaskLane(t?.lane ?? "personal");
              setTaskId(id);
            }}
            onOpenAnimal={(id) => setAnimalId(id)}
            onGotoForge={() => setTab("forge")}
          />
        ) : null}
        {tab === "forge" ? (
          <ForgeView onOpen={(id) => setClientId(id)} onCreate={() => setClientId(null)} />
        ) : null}
        {tab === "animals" ? (
          <AnimalsView onOpen={(id) => setAnimalId(id)} onCreate={() => setAnimalId(null)} />
        ) : null}
        {tab === "later" ? (
          <LaterView
            onOpen={(id) => {
              const t = tasks.find((x) => x.id === id);
              setTaskLane(t?.lane ?? "personal");
              setTaskId(id);
            }}
            onCreate={(lane) => {
              setTaskLane(lane);
              setTaskId("");
            }}
          />
        ) : null}
      </main>

      <nav className="z-20 shrink-0 border-t border-border bg-bg">
        <div className="mx-auto grid h-14 w-full max-w-2xl grid-cols-4">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                  active ? "text-fg" : "text-muted",
                )}
              >
                <span className="relative">
                  <Icon className="size-5" />
                  {t.badge ? (
                    <span className="absolute -right-2.5 -top-1 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-semibold leading-4 text-accent-fg tabular-nums">
                      {t.badge}
                    </span>
                  ) : null}
                </span>
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>

      {editingClient !== undefined ? (
        <ClientSheet client={editingClient} onClose={() => setClientId(undefined)} />
      ) : null}
      {editingAnimal !== undefined ? (
        <AnimalSheet animal={editingAnimal} onClose={() => setAnimalId(undefined)} />
      ) : null}
      {taskId !== undefined ? (
        <TaskSheet
          task={taskId ? editingTask ?? null : null}
          lane={taskLane}
          onClose={() => setTaskId(undefined)}
        />
      ) : null}
      {settings ? <SettingsSheet onClose={() => setSettings(false)} /> : null}
      {rules ? <RulesSheet onClose={() => setRules(false)} /> : null}
      <ConfirmHost />
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          className: "bg-surface2 text-fg border border-border",
        }}
      />
    </div>
  );
}
