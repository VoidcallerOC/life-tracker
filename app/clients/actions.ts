"use server";

import { revalidatePath } from "next/cache";
import { emptyClient, isStatus, type Client, type Status } from "@/lib/clients/types";
import { readClients, writeClients, resetToShippedSeed } from "@/lib/clients/storage";

const ROUTE = "/clients";
const CLIENT_ID_PREFIX = "Client1-";

export type SaveResult = { ok: true; client: Client } | { ok: false; error: string };

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

function parseMoney(value: FormDataEntryValue | null): number | null {
  if (value == null) return null;
  const cleaned = String(value).trim().replace(/[$,]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function field(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function clientFromForm(formData: FormData, id: string): Client {
  const statusRaw = field(formData, "status");
  const status: Status = isStatus(statusRaw) ? statusRaw : "Potential";
  return {
    id,
    client: field(formData, "client"),
    businessType: field(formData, "businessType"),
    status,
    contacted: field(formData, "contacted") === "true",
    contactName: field(formData, "contactName"),
    phone: field(formData, "phone"),
    email: field(formData, "email"),
    address: field(formData, "address"),
    quoted: parseMoney(formData.get("quoted")),
    deposit: parseMoney(formData.get("deposit")),
    paid: parseMoney(formData.get("paid")),
    paidDate: field(formData, "paidDate"),
    githubRepo: field(formData, "githubRepo"),
    liveUrl: field(formData, "liveUrl"),
    domain: field(formData, "domain"),
    nextAction: field(formData, "nextAction"),
    notes: field(formData, "notes"),
    lastContacted: field(formData, "lastContacted"),
  };
}

function revalidateClientPages() {
  revalidatePath(ROUTE);
  revalidatePath("/");
}

export async function saveClient(formData: FormData): Promise<SaveResult> {
  const id = field(formData, "id");
  if (!id) return { ok: false, error: "Missing client id." };
  const submitted = clientFromForm(formData, id);
  if (!submitted.client) return { ok: false, error: "Client name is required." };

  try {
    const clients = await readClients();
    const idx = clients.findIndex((c) => c.id === id);
    if (idx === -1) {
      clients.unshift(submitted);
    } else {
      clients[idx] = formData.has("contacted")
        ? submitted
        : { ...submitted, contacted: clients[idx].contacted };
    }
    await writeClients(clients);
    revalidateClientPages();
    return { ok: true, client: submitted };
  } catch (error) {
    console.error("saveClient failed", error);
    return { ok: false, error: "Storage write failed. Check Vercel Blob." };
  }
}

export async function createClient(formData: FormData): Promise<SaveResult> {
  const submittedName = field(formData, "client");
  if (!submittedName) return { ok: false, error: "Client name is required." };

  try {
    const clients = await readClients();
    const id = nextClientId(clients);
    const next = clientFromForm(formData, id);
    clients.unshift(next);
    await writeClients(clients);
    revalidateClientPages();
    return { ok: true, client: next };
  } catch (error) {
    console.error("createClient failed", error);
    return { ok: false, error: "Storage write failed. Check Vercel Blob." };
  }
}

export async function reseedFromRepo() {
  await resetToShippedSeed();
  revalidateClientPages();
}

export async function backfillPaidDates(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const clients = await readClients();
  let count = 0;
  const next = clients.map((c) => {
    if (c.status === "Paid" && c.paid && !c.paidDate) {
      count += 1;
      return { ...c, paidDate: today };
    }
    return c;
  });
  if (count > 0) {
    await writeClients(next);
    revalidateClientPages();
  }
  return count;
}

export async function setStatus(id: string, status: Status): Promise<boolean> {
  if (!isStatus(status) || !id) return false;

  try {
    const clients = await readClients();
    const idx = clients.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    clients[idx] = { ...clients[idx], status };
    await writeClients(clients);
    revalidateClientPages();
    return true;
  } catch (error) {
    console.error("Unable to persist client status", error);
    return false;
  }
}

export async function setContacted(id: string, contacted: boolean): Promise<boolean> {
  if (!id || typeof contacted !== "boolean") return false;

  try {
    const clients = await readClients();
    const idx = clients.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    clients[idx] = { ...clients[idx], contacted };
    await writeClients(clients);
    revalidateClientPages();
    return true;
  } catch (error) {
    console.error("Unable to persist contacted state", error);
    return false;
  }
}

export async function deleteClient(id: string): Promise<SaveResult> {
  if (!id) return { ok: false, error: "Missing client id." };
  try {
    const clients = await readClients();
    const existing = clients.find((c) => c.id === id);
    if (!existing) return { ok: false, error: "Client not found." };
    await writeClients(clients.filter((c) => c.id !== id));
    revalidateClientPages();
    return { ok: true, client: existing };
  } catch (error) {
    console.error("deleteClient failed", error);
    return { ok: false, error: "Storage write failed. Check Vercel Blob." };
  }
}

function parseBulkNames(text: string): string[] {
  const names: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const first = line.includes(",") ? line.split(",")[0].trim() : line;
    if (!first) continue;
    const lower = first.toLowerCase();
    if (lower === "client" || lower === "name" || lower === "business") continue;
    names.push(first);
  }
  return names;
}

export async function bulkAdd(formData: FormData) {
  const names = parseBulkNames(String(formData.get("names") ?? ""));
  if (names.length === 0) return;
  const clients = await readClients();
  const existing = new Set(clients.map((c) => c.client.toLowerCase()));
  const added: Client[] = [];
  for (const name of names) {
    if (existing.has(name.toLowerCase())) continue;
    existing.add(name.toLowerCase());
    added.push({
      ...emptyClient(),
      id: nextClientId([...added, ...clients]),
      client: name,
      status: "Potential",
    });
  }
  if (added.length === 0) return;
  await writeClients([...added, ...clients]);
  revalidateClientPages();
}
