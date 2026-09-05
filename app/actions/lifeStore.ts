"use server";

import { revalidatePath } from "next/cache";
import type { Store } from "@/lib/types";
import { writeStore, resetStore } from "@/lib/lifeStore/storage";

export async function saveStore(store: Store): Promise<void> {
  await writeStore(store);
  revalidatePath("/");
}

export async function resetStoreAction(): Promise<Store> {
  const empty = await resetStore();
  revalidatePath("/");
  return empty;
}
