import { useState } from "react";
import { toast } from "sonner";
import { SheetFrame } from "@/components/sheet-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusPill } from "@/components/ui/badge";
import { ContactActions } from "@/components/contact-actions";
import { askConfirm } from "@/components/confirm-gate";
import { useLifeStore } from "@/lib/life-store";
import type { Client, Status } from "@/lib/types";
import { emptyClient } from "@/lib/types";
import {
  addPotentialError,
  clientNameError,
  deleteClientError,
  lostReasonError,
  paidAmountError,
} from "@/lib/guardrails";
import { formatMoney, parseMoney } from "@/lib/money";
import { todayIso } from "@/lib/dates";

const STATUSES: Status[] = ["Potential", "Pending", "Paid", "Lost"];

export function ClientSheet({
  client,
  onClose,
}: {
  client: Client | null;
  onClose: () => void;
}) {
  const creating = client == null;
  const clients = useLifeStore((s) => s.clients);
  const addClient = useLifeStore((s) => s.addClient);
  const updateClient = useLifeStore((s) => s.updateClient);
  const setClientStatus = useLifeStore((s) => s.setClientStatus);
  const deleteClient = useLifeStore((s) => s.deleteClient);
  const [draft, setDraft] = useState<Omit<Client, "id">>(() =>
    client ? { ...client } : emptyClient(),
  );
  const [forceAdd, setForceAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setError(null);
  }

  function save() {
    const nameErr = clientNameError(draft.name);
    if (nameErr) {
      setError(nameErr);
      return;
    }
    if (creating) {
      const cap = addPotentialError(clients, forceAdd);
      if (cap) {
        setError(cap);
        setForceAdd(true);
        return;
      }
      addClient(draft);
      toast(`Added ${draft.name.trim()}`);
    } else if (client) {
      updateClient(client.id, draft);
      toast(`Saved ${draft.name.trim()}`);
    }
    onClose();
  }

  async function changeStatus(next: Status) {
    if (!client) {
      patch("status", next);
      return;
    }
    if (next === client.status) return;
    if (next === "Paid") {
      const res = await askConfirm({
        title: `Mark ${client.name} paid?`,
        body: "Type the dollar amount collected. Zero is not allowed.",
        confirmLabel: "Mark paid",
        kind: "amount",
      });
      if (!res.ok || res.amount == null) return;
      const err = paidAmountError(res.amount);
      if (err) {
        toast.error(err);
        return;
      }
      setClientStatus(client.id, "Paid", { paid: res.amount, paidDate: todayIso() });
      toast(`Marked ${client.name} paid · ${formatMoney(res.amount)}`);
      onClose();
      return;
    }
    if (next === "Lost") {
      const res = await askConfirm({
        title: `Mark ${client.name} lost?`,
        body: "This hides them from the pipeline. The record stays.",
        confirmLabel: "Mark lost",
        danger: true,
        kind: "reason",
      });
      if (!res.ok || !res.reason) return;
      const err = lostReasonError(res.reason);
      if (err) {
        toast.error(err);
        return;
      }
      setClientStatus(client.id, "Lost", { notes: client.notes ? `${client.notes}\nLost: ${res.reason}` : `Lost: ${res.reason}` });
      toast(`Marked ${client.name} lost`);
      onClose();
      return;
    }
    const res = await askConfirm({
      title: `Move ${client.name} to ${next}?`,
      body: "You can undo this from the header.",
      confirmLabel: `Set ${next}`,
    });
    if (!res.ok) return;
    setClientStatus(client.id, next);
    toast(`${client.name} → ${next}`);
    onClose();
  }

  async function remove() {
    if (!client) return;
    const locked = deleteClientError(client);
    if (locked) {
      toast.error(locked);
      return;
    }
    const res = await askConfirm({
      title: `Delete ${client.name}?`,
      body: "Type the shop name. This is undoable for a bit.",
      confirmLabel: "Delete",
      danger: true,
      kind: "type-name",
      expectedName: client.name,
    });
    if (!res.ok) return;
    deleteClient(client.id);
    toast(`Deleted ${client.name}`);
    onClose();
  }

  return (
    <SheetFrame
      title={creating ? "New shop" : client.name}
      subtitle={creating ? "Name is required. Next action is strongly recommended." : client.businessType || undefined}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          {error ? <p className="text-sm text-overdue">{error}</p> : null}
          <div className="flex gap-2">
            {!creating && client?.status !== "Paid" ? (
              <Button variant="danger" className="shrink-0" onClick={remove}>
                Delete
              </Button>
            ) : null}
            <Button className="flex-1" onClick={save}>
              {creating ? (forceAdd ? "Add anyway" : "Add shop") : "Save"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {!creating && client ? <ContactActions client={{ ...client, ...draft, id: client.id }} /> : null}
        <div>
          <Label htmlFor="c-name">Shop name</Label>
          <Input id="c-name" value={draft.name} onChange={(e) => patch("name", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="c-type">Type</Label>
          <Input
            id="c-type"
            value={draft.businessType}
            onChange={(e) => patch("businessType", e.target.value)}
            placeholder="comics / TCG / vintage"
          />
        </div>
        <div>
          <Label>Status</Label>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => (creating ? patch("status", s) : changeStatus(s))}
                className={s === draft.status ? "opacity-100" : "opacity-50"}
              >
                <StatusPill status={s} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="c-next">Next action</Label>
          <Textarea
            id="c-next"
            value={draft.nextAction}
            onChange={(e) => patch("nextAction", e.target.value)}
            placeholder="One sentence. What do you do next?"
          />
        </div>
        <div>
          <Label htmlFor="c-due">Due</Label>
          <Input id="c-due" type="date" value={draft.dueDate} onChange={(e) => patch("dueDate", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="c-phone">Phone</Label>
            <Input id="c-phone" value={draft.phone} onChange={(e) => patch("phone", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="c-contact">Contact</Label>
            <Input id="c-contact" value={draft.contactName} onChange={(e) => patch("contactName", e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="c-email">Email</Label>
          <Input id="c-email" type="email" value={draft.email} onChange={(e) => patch("email", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="c-addr">Address</Label>
          <Input id="c-addr" value={draft.address} onChange={(e) => patch("address", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="c-url">Live URL</Label>
            <Input id="c-url" value={draft.liveUrl} onChange={(e) => patch("liveUrl", e.target.value)} placeholder="https://" />
          </div>
          <div>
            <Label htmlFor="c-domain">Domain</Label>
            <Input id="c-domain" value={draft.domain} onChange={(e) => patch("domain", e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="c-repo">GitHub repo</Label>
          <Input id="c-repo" value={draft.githubRepo} onChange={(e) => patch("githubRepo", e.target.value)} placeholder="VoidcallerOC/…" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <MoneyField label="Quoted" value={draft.quoted} onChange={(n) => patch("quoted", n)} />
          <MoneyField label="Deposit" value={draft.deposit} onChange={(n) => patch("deposit", n)} />
          <MoneyField label="Paid" value={draft.paid} onChange={(n) => patch("paid", n)} />
        </div>
        <div>
          <Label htmlFor="c-notes">Notes</Label>
          <Textarea id="c-notes" value={draft.notes} onChange={(e) => patch("notes", e.target.value)} />
        </div>
      </div>
    </SheetFrame>
  );
}

function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        inputMode="decimal"
        value={value == null ? "" : String(value)}
        onChange={(e) => onChange(parseMoney(e.target.value))}
        placeholder="0"
      />
    </div>
  );
}
