import { NextResponse } from "next/server";
import { emptyClient, isStatus, type Client } from "@/lib/clients/types";
import { isAuthorizedRequest } from "@/lib/auth";
import { readClients, writeClients } from "@/lib/clients/storage";

export const dynamic = "force-dynamic";

const CLIENT_ID_PREFIX = "Client1-";
const POTENTIAL_QUEUE = [
  "Client1-016", "Client1-009", "Client1-010", "Client1-059", "Client1-061", "Client1-058",
  "Client1-011", "Client1-063", "Client1-014", "Client1-038", "Client1-039", "Client1-042",
  "Client1-041", "Client1-040", "Client1-013", "Client1-015", "Client1-019", "Client1-018",
  "Client1-017", "Client1-064", "Client1-066", "Client1-065", "Client1-023", "Client1-022",
  "Client1-026", "Client1-027", "Client1-047", "Client1-046", "Client1-044", "Client1-045",
  "Client1-043", "Client1-030", "Client1-048", "Client1-049", "Client1-050", "Client1-051",
  "Client1-052", "Client1-028", "Client1-031", "Client1-056", "Client1-057", "Client1-032",
  "Client1-033", "Client1-034", "Client1-035", "Client1-036", "Client1-053", "Client1-054",
  "Client1-055", "Client1-062", "Client1-067", "Client1-020", "Client1-024", "Client1-025",
];

function nextClientId(clients: Client[]): string {
  const used = new Set(clients.map((client) => client.id));
  let sequence = 1;
  for (const client of clients) {
    const match = client.id.match(/^Client1-(\d+)$/i);
    if (match) sequence = Math.max(sequence, Number(match[1]) + 1);
  }
  let id = `${CLIENT_ID_PREFIX}${String(sequence).padStart(3, "0")}`;
  while (used.has(id)) id = `${CLIENT_ID_PREFIX}${String(++sequence).padStart(3, "0")}`;
  return id;
}

function stripQueuePrefix(action: string): string {
  return action.replace(/^#?\d{1,2}\s*[.—\-:]\s*/u, "").trim();
}

function parseMoneyParam(raw: string | null): number | null | undefined {
  if (raw == null) return undefined;
  const cleaned = raw.trim();
  if (!cleaned) return null;
  const match = cleaned.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function text(body: Record<string, unknown>, key: string): string {
  return typeof body[key] === "string" ? body[key].trim() : "";
}

function moneyFromBody(body: Record<string, unknown>, key: string): number | null | undefined {
  if (!(key in body)) return undefined;
  const v = body[key];
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const match = String(v).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: Request) {
  if (!isAuthorizedRequest(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const clients = await readClients();
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ clients });
  const idx = clients.findIndex((c) => c.id === id);
  if (idx === -1) return NextResponse.json({ error: "client not found" }, { status: 404 });

  const nextAction = url.searchParams.get("nextAction");
  const notes = url.searchParams.get("notes");
  const paidDate = url.searchParams.get("paidDate");
  const lastContacted = url.searchParams.get("lastContacted");
  const statusRaw = url.searchParams.get("status");
  const contactedRaw = url.searchParams.get("contacted");
  const quoted = parseMoneyParam(url.searchParams.get("quoted"));
  const deposit = parseMoneyParam(url.searchParams.get("deposit"));
  const paid = parseMoneyParam(url.searchParams.get("paid"));

  const hasUpdate =
    nextAction !== null ||
    notes !== null ||
    paidDate !== null ||
    lastContacted !== null ||
    statusRaw !== null ||
    contactedRaw !== null ||
    quoted !== undefined ||
    deposit !== undefined ||
    paid !== undefined;

  if (!hasUpdate) return NextResponse.json({ client: clients[idx] });

  const updated = { ...clients[idx] };
  if (nextAction !== null) updated.nextAction = nextAction;
  if (notes !== null) updated.notes = notes;
  if (paidDate !== null) updated.paidDate = paidDate;
  if (lastContacted !== null) updated.lastContacted = lastContacted;
  if (statusRaw !== null && isStatus(statusRaw)) updated.status = statusRaw;
  if (contactedRaw === "true") updated.contacted = true;
  if (contactedRaw === "false") updated.contacted = false;
  if (quoted !== undefined) updated.quoted = quoted;
  if (deposit !== undefined) updated.deposit = deposit;
  if (paid !== undefined) updated.paid = paid;

  clients[idx] = updated;
  await writeClients(clients);
  return NextResponse.json({ client: updated });
}

export async function POST(request: Request) {
  if (!isAuthorizedRequest(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await jsonBody(request);
  let clients = await readClients();
  const action = text(body, "action");

  if (action === "applyQueue") {
    const byId = new Map(clients.map((c) => [c.id, c]));
    const paid = clients.filter((c) => c.status === "Paid");
    const pending = clients.filter((c) => c.status === "Pending");
    const lost = clients.filter((c) => c.status === "Lost");
    const contacts = clients.filter((c) => c.status === "Potential" && c.contacted);
    const other = clients.filter((c) => c.status === "Potential" && !c.contacted && !POTENTIAL_QUEUE.includes(c.id));
    const queued: Client[] = [];
    POTENTIAL_QUEUE.forEach((id, index) => {
      const client = byId.get(id);
      if (!client || client.status !== "Potential" || client.contacted) return;
      const rest = stripQueuePrefix(client.nextAction) || "Pitch";
      queued.push({ ...client, nextAction: `#${String(index + 1).padStart(2, "0")} — ${rest}` });
    });
    const next = [...paid, ...pending, ...queued, ...other, ...contacts, ...lost];
    await writeClients(next);
    return NextResponse.json({ ok: true, queued: queued.map(({ id, client, nextAction }) => ({ id, client, nextAction })), leftoverPotential: other.map((c) => c.client) });
  }

  if (action === "create") {
    const name = text(body, "client");
    if (!name) return NextResponse.json({ error: "client name required" }, { status: 400 });
    const existing = clients.find((c) => c.client.toLowerCase() === name.toLowerCase());
    if (existing) return NextResponse.json({ client: existing, created: false });
    const statusRaw = text(body, "status");
    const created: Client = {
      ...emptyClient(), id: nextClientId(clients), client: name,
      businessType: text(body, "businessType"), status: isStatus(statusRaw) ? statusRaw : "Pending",
      contactName: text(body, "contactName"), phone: text(body, "phone"), address: text(body, "address"),
      githubRepo: text(body, "githubRepo"), liveUrl: text(body, "liveUrl"), domain: text(body, "domain"),
      nextAction: text(body, "nextAction"), notes: text(body, "notes"), contacted: body.contacted === true,
    };
    clients.unshift(created);
    await writeClients(clients);
    return NextResponse.json({ client: created, created: true }, { status: 201 });
  }

  return NextResponse.json({ error: "unsupported action" }, { status: 400 });
}

export async function PATCH(request: Request) {
  if (!isAuthorizedRequest(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await jsonBody(request);
  const id = text(body, "id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const clients = await readClients();
  const idx = clients.findIndex((c) => c.id === id);
  if (idx === -1) return NextResponse.json({ error: "client not found" }, { status: 404 });
  const updated = { ...clients[idx] };
  for (const key of ["nextAction", "notes", "paidDate", "lastContacted"] as const) {
    if (typeof body[key] === "string") updated[key] = body[key].trim();
  }
  const quoted = moneyFromBody(body, "quoted");
  const deposit = moneyFromBody(body, "deposit");
  const paid = moneyFromBody(body, "paid");
  if (quoted !== undefined) updated.quoted = quoted;
  if (deposit !== undefined) updated.deposit = deposit;
  if (paid !== undefined) updated.paid = paid;
  if (typeof body.status === "string" && isStatus(body.status)) updated.status = body.status;
  if (typeof body.contacted === "boolean") updated.contacted = body.contacted;
  clients[idx] = updated;
  await writeClients(clients);
  return NextResponse.json({ client: updated });
}

export async function DELETE(request: Request) {
  if (!isAuthorizedRequest(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await jsonBody(request);
  const id = text(body, "id") || new URL(request.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const clients = await readClients();
  const existing = clients.find((c) => c.id === id);
  if (!existing) return NextResponse.json({ error: "client not found" }, { status: 404 });
  await writeClients(clients.filter((c) => c.id !== id));
  return NextResponse.json({ ok: true, deleted: existing.client, id });
}
