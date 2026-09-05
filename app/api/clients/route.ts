import { NextResponse } from "next/server";
import { isStatus, type Client } from "@/lib/clients/types";
import { readClients, writeClients } from "@/lib/clients/storage";

export const dynamic = "force-dynamic";

function asClient(body: Record<string, unknown>, id: string, previous?: Client): Client {
  const statusRaw = String(body.status ?? previous?.status ?? "Potential");
  const status = isStatus(statusRaw) ? statusRaw : "Potential";
  const money = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    const n = Number(String(v).replace(/[$,]/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  const str = (v: unknown, fallback = "") => String(v ?? fallback).trim();

  return {
    id,
    client: str(body.client, previous?.client ?? ""),
    businessType: str(body.businessType, previous?.businessType ?? ""),
    status,
    contacted:
      body.contacted === true || body.contacted === "true"
        ? true
        : body.contacted === false || body.contacted === "false"
          ? false
          : Boolean(previous?.contacted),
    contactName: str(body.contactName, previous?.contactName ?? ""),
    phone: str(body.phone, previous?.phone ?? ""),
    email: str(body.email, previous?.email ?? ""),
    address: str(body.address, previous?.address ?? ""),
    quoted: money(body.quoted) ?? previous?.quoted ?? null,
    deposit: money(body.deposit) ?? previous?.deposit ?? null,
    paid: money(body.paid) ?? previous?.paid ?? null,
    paidDate: str(body.paidDate, previous?.paidDate ?? ""),
    githubRepo: str(body.githubRepo, previous?.githubRepo ?? ""),
    liveUrl: str(body.liveUrl, previous?.liveUrl ?? ""),
    domain: str(body.domain, previous?.domain ?? ""),
    nextAction: str(body.nextAction, previous?.nextAction ?? ""),
    notes: str(body.notes, previous?.notes ?? ""),
    lastContacted: str(body.lastContacted, previous?.lastContacted ?? ""),
  };
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "Missing client id." }, { status: 400 });
  if (!String(body.client ?? "").trim()) {
    return NextResponse.json({ ok: false, error: "Client name is required." }, { status: 400 });
  }

  try {
    const clients = await readClients();
    const idx = clients.findIndex((c) => c.id === id);
    const next = asClient(body, id, idx === -1 ? undefined : clients[idx]);
    if (idx === -1) clients.unshift(next);
    else clients[idx] = next;
    await writeClients(clients);
    return NextResponse.json({ ok: true, client: next });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Storage write failed";
    console.error("POST /api/clients failed", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
