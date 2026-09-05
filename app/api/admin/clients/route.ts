import { NextResponse } from "next/server";
import { isAuthorizedRequest } from "@/lib/auth";
import { readClients, writeClients } from "@/lib/clients/storage";

export const dynamic = "force-dynamic";

// One-off maintenance endpoint for editing the Forge pipeline outside the
// browser UI (e.g. from an automated session with no way to do an
// interactive cookie login or submit a form POST). GET-only by necessity —
// the fetch tool available to that automation can't send a request body —
// so an update is expressed as GET params rather than a PATCH body. Scoped
// tightly on purpose: it can only set nextAction/notes on an existing
// client, never create, delete, or touch money fields. Same auth as
// /api/summary; see isAuthorizedRequest in lib/auth.ts.
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
  if (nextAction === null && notes === null) {
    return NextResponse.json({ client: clients[idx] });
  }

  const updated = {
    ...clients[idx],
    ...(nextAction !== null ? { nextAction } : {}),
    ...(notes !== null ? { notes } : {}),
  };
  clients[idx] = updated;
  await writeClients(clients);
  return NextResponse.json({ client: updated });
}
