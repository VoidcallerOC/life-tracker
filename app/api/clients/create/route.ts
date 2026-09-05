import { NextResponse } from "next/server";
import { emptyClient, isStatus, type Client } from "@/lib/clients/types";
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

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body.client ?? "").trim();
  if (!name) return NextResponse.json({ ok: false, error: "Client name is required." }, { status: 400 });

  const money = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    const n = Number(String(v).replace(/[$,]/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  const str = (v: unknown) => String(v ?? "").trim();
  const statusRaw = str(body.status);

  try {
    const clients = await readClients();
    const created: Client = {
      ...emptyClient(),
      id: nextClientId(clients),
      client: name,
      businessType: str(body.businessType),
      status: isStatus(statusRaw) ? statusRaw : "Potential",
      contactName: str(body.contactName),
      phone: str(body.phone),
      email: str(body.email),
      address: str(body.address),
      quoted: money(body.quoted),
      deposit: money(body.deposit),
      paid: money(body.paid),
      paidDate: str(body.paidDate),
      githubRepo: str(body.githubRepo),
      liveUrl: str(body.liveUrl),
      domain: str(body.domain),
      nextAction: str(body.nextAction),
      notes: str(body.notes),
      lastContacted: str(body.lastContacted),
    };
    clients.unshift(created);
    await writeClients(clients);
    return NextResponse.json({ ok: true, client: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Storage write failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
