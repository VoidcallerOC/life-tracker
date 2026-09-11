import { NextResponse } from "next/server";
import { isStatus, type Client } from "@/lib/clients/types";
import { mergeMoneyNote, parseMoney } from "@/lib/clients/money";
import { readClients, writeClients } from "@/lib/clients/storage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function asClient(body: Record<string, unknown>, previous: Client): Client {
  const statusRaw = str(body.status) || previous.status;
  let notes = Object.prototype.hasOwnProperty.call(body, "notes") ? str(body.notes) : previous.notes;
  if (Object.prototype.hasOwnProperty.call(body, "quoted")) {
    notes = mergeMoneyNote(notes, "Quoted", body.quoted);
  }
  if (Object.prototype.hasOwnProperty.call(body, "deposit")) {
    notes = mergeMoneyNote(notes, "Deposit", body.deposit);
  }
  if (Object.prototype.hasOwnProperty.call(body, "paid")) {
    notes = mergeMoneyNote(notes, "Paid", body.paid);
  }
  return {
    ...previous,
    client: str(body.client) || previous.client,
    businessType: Object.prototype.hasOwnProperty.call(body, "businessType")
      ? str(body.businessType)
      : previous.businessType,
    status: isStatus(statusRaw) ? statusRaw : previous.status,
    contactName: Object.prototype.hasOwnProperty.call(body, "contactName")
      ? str(body.contactName)
      : previous.contactName,
    phone: Object.prototype.hasOwnProperty.call(body, "phone") ? str(body.phone) : previous.phone,
    email: Object.prototype.hasOwnProperty.call(body, "email") ? str(body.email) : previous.email,
    address: Object.prototype.hasOwnProperty.call(body, "address") ? str(body.address) : previous.address,
    quoted: Object.prototype.hasOwnProperty.call(body, "quoted") ? parseMoney(body.quoted) : previous.quoted,
    deposit: Object.prototype.hasOwnProperty.call(body, "deposit") ? parseMoney(body.deposit) : previous.deposit,
    paid: Object.prototype.hasOwnProperty.call(body, "paid") ? parseMoney(body.paid) : previous.paid,
    paidDate: Object.prototype.hasOwnProperty.call(body, "paidDate") ? str(body.paidDate) : previous.paidDate,
    githubRepo: Object.prototype.hasOwnProperty.call(body, "githubRepo")
      ? str(body.githubRepo)
      : previous.githubRepo,
    liveUrl: Object.prototype.hasOwnProperty.call(body, "liveUrl") ? str(body.liveUrl) : previous.liveUrl,
    domain: Object.prototype.hasOwnProperty.call(body, "domain") ? str(body.domain) : previous.domain,
    nextAction: Object.prototype.hasOwnProperty.call(body, "nextAction")
      ? str(body.nextAction)
      : previous.nextAction,
    notes,
    lastContacted: Object.prototype.hasOwnProperty.call(body, "lastContacted")
      ? str(body.lastContacted)
      : previous.lastContacted,
  };
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const id = str(body.id);
  if (!id) return NextResponse.json({ ok: false, error: "Missing client id." }, { status: 400 });
  if (!str(body.client)) {
    return NextResponse.json({ ok: false, error: "Client name is required." }, { status: 400 });
  }

  try {
    const clients = await readClients();
    const idx = clients.findIndex((c) => c.id === id);
    if (idx === -1) {
      return NextResponse.json({ ok: false, error: `Client ${id} not found.` }, { status: 404 });
    }
    const next = asClient(body, clients[idx]);
    clients[idx] = next;
    await writeClients(clients);
    console.info("saved client", {
      id: next.id,
      paidRaw: body.paid,
      paid: next.paid,
      paidDate: next.paidDate,
      nextAction: next.nextAction,
    });
    return NextResponse.json({ ok: true, client: next });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Storage write failed";
    console.error("POST /api/clients failed", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
