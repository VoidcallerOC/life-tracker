import { NextResponse } from "next/server";
import { emptyClient, isStatus, type Client } from "@/lib/clients/types";
import { isAuthorizedRequest } from "@/lib/auth";
import { readClients, writeClients } from "@/lib/clients/storage";

export const dynamic = "force-dynamic";

const CLIENT_ID_PREFIX = "Client1-";

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

export async function GET(request: Request) {
  if (!isAuthorizedRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const clients = await readClients();

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
      status: isStatus(url.searchParams.get("status") ?? "") ? (url.searchParams.get("status") as Client["status"]) : "Pending",
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
