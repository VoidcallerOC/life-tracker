"use server";

import { revalidatePath } from "next/cache";
import { isStatus, type Client, type Status } from "@/lib/clients/types";
import { emptyClient as emptyDomainClient, rid } from "@/lib/os/types";
import { fromLegacy, toLegacy } from "@/lib/clients/adapter";
import { VersionConflictError } from "@/lib/db/client";
import { requireSession } from "@/lib/session";
import * as repo from "@/lib/db/repository";

const ROUTE = "/clients";

export type SaveResult = { ok: true; client: Client } | { ok: false; error: string };

function revalidateClientPages() {
  revalidatePath(ROUTE);
  revalidatePath("/");
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

function conflictMessage(): string {
  return "This client changed on another device. Refresh to see the current version before editing.";
}

/**
 * Each of these used to read the entire client list, mutate one entry, and write
 * the whole list back. They now touch a single row and pass the version the form
 * was rendered from, so a concurrent edit is rejected instead of overwritten.
 */

export async function saveClient(formData: FormData): Promise<SaveResult> {
  try {
    await requireSession();
  } catch {
    return { ok: false, error: "Signed out. Log in again." };
  }

  const id = field(formData, "id");
  if (!id) return { ok: false, error: "Missing client id." };

  const name = field(formData, "client");
  if (!name) return { ok: false, error: "Client name is required." };

  const existing = await repo.getClient(id);
  if (!existing) return { ok: false, error: "Client not found." };

  const statusRaw = field(formData, "status");
  const next = {
    ...existing,
    name,
    businessType: field(formData, "businessType"),
    status: isStatus(statusRaw) ? statusRaw : existing.status,
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
    contacted: formData.has("contacted")
      ? field(formData, "contacted") === "true"
      : existing.contacted,
  };

  // The form carries the version it was rendered from; fall back to the row's
  // current version only when the form predates this field.
  const submittedVersion = Number(field(formData, "version"));
  const expected = Number.isInteger(submittedVersion) ? submittedVersion : existing.version;

  try {
    const saved = await repo.updateClient(next, expected);
    revalidateClientPages();
    return { ok: true, client: toLegacy(saved) };
  } catch (error) {
    if (error instanceof VersionConflictError) return { ok: false, error: conflictMessage() };
    console.error("saveClient failed", error);
    return { ok: false, error: "Save failed." };
  }
}

export async function createClient(formData: FormData): Promise<SaveResult> {
  try {
    await requireSession();
  } catch {
    return { ok: false, error: "Signed out. Log in again." };
  }

  const name = field(formData, "client");
  if (!name) return { ok: false, error: "Client name is required." };

  const statusRaw = field(formData, "status");
  const created = {
    ...emptyDomainClient(),
    id: rid(),
    version: 0,
    name,
    businessType: field(formData, "businessType"),
    status: isStatus(statusRaw) ? statusRaw : ("Potential" as Status),
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

  try {
    const saved = await repo.insertClient(created);
    revalidateClientPages();
    return { ok: true, client: toLegacy(saved) };
  } catch (error) {
    console.error("createClient failed", error);
    return { ok: false, error: "Save failed." };
  }
}

export async function backfillPaidDates(): Promise<number> {
  await requireSession();
  const today = new Date().toISOString().slice(0, 10);
  const clients = await repo.listClients();
  let count = 0;
  for (const client of clients) {
    if (client.status === "Paid" && client.paid && !client.paidDate) {
      try {
        await repo.updateClient({ ...client, paidDate: today }, client.version);
        count += 1;
      } catch (error) {
        console.error(`Could not backfill paid date for ${client.id}`, error);
      }
    }
  }
  if (count > 0) revalidateClientPages();
  return count;
}

export async function setStatus(id: string, status: Status): Promise<boolean> {
  try {
    await requireSession();
    if (!isStatus(status) || !id) return false;
    const existing = await repo.getClient(id);
    if (!existing) return false;
    await repo.updateClient({ ...existing, status }, existing.version);
    revalidateClientPages();
    return true;
  } catch (error) {
    console.error("Unable to persist client status", error);
    return false;
  }
}

export async function setContacted(id: string, contacted: boolean): Promise<boolean> {
  try {
    await requireSession();
    if (!id || typeof contacted !== "boolean") return false;
    const existing = await repo.getClient(id);
    if (!existing) return false;
    await repo.updateClient({ ...existing, contacted }, existing.version);
    revalidateClientPages();
    return true;
  } catch (error) {
    console.error("Unable to persist contacted state", error);
    return false;
  }
}

export async function deleteClient(id: string): Promise<SaveResult> {
  try {
    await requireSession();
  } catch {
    return { ok: false, error: "Signed out. Log in again." };
  }
  if (!id) return { ok: false, error: "Missing client id." };
  const existing = await repo.getClient(id);
  if (!existing) return { ok: false, error: "Client not found." };
  try {
    await repo.softDeleteClient(id, existing.version);
    revalidateClientPages();
    return { ok: true, client: toLegacy(existing) };
  } catch (error) {
    if (error instanceof VersionConflictError) return { ok: false, error: conflictMessage() };
    console.error("deleteClient failed", error);
    return { ok: false, error: "Delete failed." };
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
  await requireSession();
  const names = parseBulkNames(String(formData.get("names") ?? ""));
  if (names.length === 0) return;

  const existing = await repo.listClients();
  const seen = new Set(existing.map((c) => c.name.toLowerCase()));
  let added = 0;
  for (const name of names) {
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    await repo.insertClient({ ...emptyDomainClient(), id: rid(), version: 0, name, status: "Potential" });
    added += 1;
  }
  if (added > 0) revalidateClientPages();
}

/** Used by the spreadsheet page to load rows in its own field naming. */
export async function listLegacyClients(): Promise<Client[]> {
  await requireSession();
  return (await repo.listClients()).map(toLegacy);
}
