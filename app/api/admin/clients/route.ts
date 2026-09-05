import { NextResponse } from "next/server";
import { emptyClient, isStatus, type Client } from "@/lib/clients/types";
import { isAuthorizedRequest } from "@/lib/auth";
import { readClients, writeClients } from "@/lib/clients/storage";

export const dynamic = "force-dynamic";

const CLIENT_ID_PREFIX = "Client1-";

const POTENTIAL_QUEUE = [
  "Client1-016",
  "Client1-009",
  "Client1-010",
  "Client1-059",
  "Client1-061",
  "Client1-058",
  "Client1-011",
  "Client1-063",
  "Client1-014",
  "Client1-038",
  "Client1-039",
  "Client1-042",
  "Client1-041",
  "Client1-040",
  "Client1-013",
  "Client1-015",
  "Client1-019",
  "Client1-018",
  "Client1-017",
  "Client1-064",
  "Client1-066",
  "Client1-065",
  "Client1-023",
  "Client1-022",
  "Client1-026",
  "Client1-027",
  "Client1-047",
  "Client1-046",
  "Client1-044",
  "Client1-045",
  "Client1-043",
  "Client1-030",
  "Client1-048",
  "Client1-049",
  "Client1-050",
  "Client1-051",
  "Client1-052",
  "Client1-028",
  "Client1-031",
  "Client1-056",
  "Client1-057",
  "Client1-032",
  "Client1-033",
  "Client1-034",
  "Client1-035",
  "Client1-036",
  "Client1-053",
  "Client1-054",
  "Client1-055",
  "Client1-062",
  "Client1-067",
  "Client1-020",
  "Client1-024",
  "Client1-025",
];

function nextClientId(clients: Client[]): string {
  const used = new Set(clients.map((client) => client.id));
  let sequence = 1;
  for (const client of clients) {
    const match = client.id.match(/^Client1-(\d+)$/i);
    if (match) sequence = Math.max(sequence, Number(match[1]) + 1);
  }
  let id = `${CLIENT_ID_PREFIX}${String(sequence).padStart(3, "0")}`;
  while (used.has(id)) {
    sequence += 1;
    id = `${CLIENT_ID_PREFIX}${String(sequence).padStart(3, "0")}`;
  }
  return id;
}

function stripQueuePrefix(action: string): string {
  return action.replace(/^#?\d{1,2}\s*[.—\-:]\s*/u, "").trim();
}

export async function GET(request: Request) {
  if (!isAuthorizedRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  let clients = await readClients();

  if (url.searchParams.get("delete") === "1") {
    const deleteId = url.searchParams.get("id");
    if (!deleteId) return NextResponse.json({ error: "id required" }, { status: 400 });
    const existing = clients.find((c) => c.id === deleteId);
    if (!existing) return NextResponse.json({ error: "client not found" }, { status: 404 });
    clients = clients.filter((c) => c.id !== deleteId);
    await writeClients(clients);
    return NextResponse.json({ ok: true, deleted: existing.client, id: deleteId });
  }

  if (url.searchParams.get("applyQueue") === "1") {
    const byId = new Map(clients.map((c) => [c.id, c]));
    const paid = clients.filter((c) => c.status === "Paid");
    const pending = clients.filter((c) => c.status === "Pending");
    const lost = clients.filter((c) => c.status === "Lost");
    const other = clients.filter(
      (c) => c.status === "Potential" && !POTENTIAL_QUEUE.includes(c.id),
    );

    const queued: Client[] = [];
    POTENTIAL_QUEUE.forEach((id, index) => {
      const client = byId.get(id);
      if (!client || client.status !== "Potential") return;
      const n = String(index + 1).padStart(2, "0");
      const rest = stripQueuePrefix(client.nextAction) || "Pitch";
      queued.push({ ...client, nextAction: `#${n} — ${rest}` });
    });

    const next = [...paid, ...pending, ...queued, ...other, ...lost];
    await writeClients(next);
    return NextResponse.json({
      ok: true,
      queued: queued.map((c) => ({ id: c.id, client: c.client, nextAction: c.nextAction })),
      leftoverPotential: other.map((c) => c.client),
    });
  }

  if (url.searchParams.get("create") === "1") {
    const name = (url.searchParams.get("client") ?? "").trim();
    if (!name) return NextResponse.json({ error: "client name required" }, { status: 400 });
    if (clients.some((c) => c.client.toLowerCase() === name.toLowerCase())) {
      const existing = clients.find((c) => c.client.toLowerCase() === name.toLowerCase());
      return NextResponse.json({ client: existing, created: false });
    }
    const created: Client = {
      ...emptyClient(),
      id: nextClientId(clients),
      client: name,
      businessType: url.searchParams.get("businessType") ?? "",
      status: isStatus(url.searchParams.get("status") ?? "")
        ? (url.searchParams.get("status") as Client["status"])
        : "Pending",
      contactName: url.searchParams.get("contactName") ?? "",
      phone: url.searchParams.get("phone") ?? "",
      address: url.searchParams.get("address") ?? "",
      githubRepo: url.searchParams.get("githubRepo") ?? "",
      liveUrl: url.searchParams.get("liveUrl") ?? "",
      domain: url.searchParams.get("domain") ?? "",
      nextAction: url.searchParams.get("nextAction") ?? "",
      notes: url.searchParams.get("notes") ?? "",
      contacted: url.searchParams.get("contacted") === "true",
    };
    clients.unshift(created);
    await writeClients(clients);
    return NextResponse.json({ client: created, created: true });
  }

  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ clients });
  }

  const idx = clients.findIndex((c) => c.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: "client not found" }, { status: 404 });
  }

  const nextAction = url.searchParams.get("nextAction");
  const notes = url.searchParams.get("notes");
  const paidDate = url.searchParams.get("paidDate");
  const paidRaw = url.searchParams.get("paid");
  const statusRaw = url.searchParams.get("status");

  const hasUpdate =
    nextAction !== null ||
    notes !== null ||
    paidDate !== null ||
    paidRaw !== null ||
    statusRaw !== null;

  if (!hasUpdate) {
    return NextResponse.json({ client: clients[idx] });
  }

  const updated = { ...clients[idx] };
  if (nextAction !== null) updated.nextAction = nextAction;
  if (notes !== null) updated.notes = notes;
  if (paidDate !== null) updated.paidDate = paidDate;
  if (paidRaw !== null) {
    const cleaned = paidRaw.trim();
    if (!cleaned) updated.paid = null;
    else {
      const n = Number(cleaned);
      if (Number.isFinite(n)) updated.paid = n;
    }
  }
  if (statusRaw !== null && isStatus(statusRaw)) updated.status = statusRaw;

  clients[idx] = updated;
  await writeClients(clients);
  return NextResponse.json({ client: updated });
}
