import { NextResponse } from "next/server";
import { isAuthorizedRequest } from "@/lib/auth";
import { isStatus } from "@/lib/clients/types";
import { readClients, writeClients } from "@/lib/clients/storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedRequest(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const clients = await readClients();

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
