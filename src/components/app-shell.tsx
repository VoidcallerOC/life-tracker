import { useMemo, useState, useEffect } from "react";
import { Briefcase, CalendarDays, ListChecks, PawPrint, RotateCcw, Settings, Shield } from "lucide-react";
import { Toaster, toast } from "sonner";
import { DoNow } from "@/components/do-now";
import { ForgeView } from "@/components/forge-view";
import { AnimalsView } from "@/components/animals-view";
import { LaterView } from "@/components/later-view";
import { ClientSheet } from "@/components/client-sheet";
import { AnimalSheet } from "@/components/animal-sheet";
import { TaskSheet } from "@/components/task-sheet";
import { SettingsSheet } from "@/components/settings-sheet";
import { RulesSheet } from "@/components/rules-sheet";
import { ConfirmHost } from "@/components/confirm-gate";
import { LockScreen } from "@/components/lock-screen";
import { Button } from "@/components/ui/button";
import { useLifeStore } from "@/lib/life-store";
import { buildQueue } from "@/lib/queue";
import { formatLongDate, weekdayHeading } from "@/lib/dates";
import { isUnlocked } from "@/lib/lock";
import { cn } from "@/lib/cn";

type Tab = "now" | "forge" | "animals" | "later";

export function AppShell() {
  const [unlocked, setUnlocked] = useState(false);
  useEffect(() => {
    if (isUnlocked()) setUnlocked(true);
  }, []);
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

  if (!unlocked) {
    return <LockScreen onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-20 w-full border-b border-border bg-bg/95 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="mx-auto flex w-full max-w-2xl items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted">
              {weekdayHeading()}
            </p>
            <h1 className="font-display text-3xl leading-none text-fg">Life OS</h1>
            <p className="mt-1 text-sm text-muted">
              {formatLongDate()}
              {queueCount > 0 ? ` · ${queueCount} in front of you` : " · board clear"}
            </p>
          </div>
          <div className="flex items-center gap-1">
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

      <main className="mx-auto max-w-2xl px-4 py-5 pb-36">
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

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/95 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto grid w-full max-w-2xl grid-cols-4 px-2">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 text-xs font-medium",
                  active ? "text-fg" : "text-muted",
                )}
              >
                <span className="relative">
                  <Icon className="size-5" />
                  {t.badge ? (
                    <span className="absolute -right-2.5 -top-1 min-w-4 rounded-full bg-accent px-1 text-center text-xs font-semibold leading-4 text-accent-fg tabular-nums">
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
      {settings ? (
        <SettingsSheet
          onClose={() => setSettings(false)}
          onLock={() => {
            setSettings(false);
            setUnlocked(false);
          }}
        />
      ) : null}
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
