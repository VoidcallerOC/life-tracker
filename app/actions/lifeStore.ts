"use server";

import { revalidatePath } from "next/cache";
import type { Store } from "@/lib/types";
import type { Client } from "@/lib/clients/types";
import { writeStore, resetStore } from "@/lib/lifeStore/storage";
import { writeClients } from "@/lib/clients/storage";

export async function saveStore(store: Store): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await writeStore(store);
    revalidatePath("/clients");
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Storage write failed";
    console.error("saveStore failed", error);
    return { ok: false, error: message };
  }
}

export async function saveClientsAction(
  clients: Client[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await writeClients(clients);
    revalidatePath("/clients");
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Storage write failed";
    console.error("saveClientsAction failed", error);
    return { ok: false, error: message };
  }
}

export async function resetStoreAction(): Promise<Store> {
  const empty = await resetStore();
  revalidatePath("/");
  revalidatePath("/clients");
  return empty;
}
