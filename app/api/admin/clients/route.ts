import { NextResponse } from "next/server";
import { emptyClient, isStatus, type Client } from "@/lib/clients/types";
import { isAuthorizedRequest } from "@/lib/auth";
import { readClients, writeClients } from "@/lib/clients/storage";

export const dynamic = "force-dynamic";

const CLIENT_ID_PREFIX = "Client1-";

// Contact sequence for Potential clients (Sep 2026 spitball).
const POTENTIAL_QUEUE = [
  "Client1-016", // 1 Salem
  "Client1-009", // 2 Infinite Heroes
  "Client1-010", // 3 IDeal Cards
  "Client1-059", // 4 Comics and Collectibles Etc
  "Client1-061", // 5 Imperial Gaming
  "Client1-058", // 6 EC3
  "Client1-011", // 7 XCLUSIVE STYLEZ
  "Client1-063", // 8 Leather Jacket Games
  "Client1-014", // 9 MapleHeart
  "Client1-038", // 10 A Hero's Legacy
  "Client1-039", // 11 Omni Cards
  "Client1-042", // 12 Collectibles and Cards
  "Client1-041", // 13 Calibrated Collectibles
  "Client1-040", // 14 History On Paper
  "Client1-013", // 15 Natural Selection Vintage
  "Client1-015", // 16 Enchanted Violet
  "Client1-019", // 17 East West Vintage
  "Client1-018", // 18 Train Wreck
  "Client1-017", // 19 4Ever Vintage
  "Client1-064", // 20 Amazing Animalz
  "Client1-066", // 21 Animal City
  "Client1-065", // 22 CT Exotic Reptiles
  "Client1-023", // 23 Connecticut Hobby
  "Client1-022", // 24 White Rabbit
  "Client1-026", // 25 Gizmo's
  "Client1-027", // 26 Flea Market at the Crossing
  "Client1-047", // 27 Plantsville Station
  "Client1-046", // 28 Route 10 Trader
  "Client1-044", // 29 Vintage From The Heart
  "Client1-045", // 30 Vintage At Strandz
  "Client1-043", // 31 Nick's Antiques
  "Client1-030", // 32 Estate Antiques
  "Client1-048", // 33 Sirko's
  "Client1-049", // 34 Country Peddler
  "Client1-050", // 35 Watertown Antiques
  "Client1-051", // 36 Unique Antiques
  "Client1-052", // 37 P M Crafts
  "Client1-028", // 38 Smith Cycles
  "Client1-031", // 39 Renaissance Cyclery
  "Client1-056", // 40 Smokin Joe's
  "Client1-057", // 41 J P Cycles
  "Client1-032", // 42 Wojtusik's
  "Client1-033", // 43 Tommy's Place
  "Client1-034", // 44 Crown Upholstery
  "Client1-035", // 45 South Side Meat
  "Client1-036", // 46 CMH Small Engine
  "Client1-053", // 47 Broad St Pawn
  "Client1-054", // 48 J & J Pawn
  "Client1-055", // 49 Tri-City Trading
  "Client1-060", // 50 Card Catcher — verify exists
  "Client1-062", // 51 Alternate Universe — skip unless asked
  "Client1-067", // 52 A to Z Pet Shop — skip unless asked
  "Client1-020", // 53 Xtreme Concepts — mall
  "Client1-024", // 54 HobbyTown Westfarms
  "Client1-025", // 55 Musical Expressions
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
  const clients = await readClients();

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
