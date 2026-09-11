import type { Store, SectionKey } from "./types";

// Legacy localStorage key from before Animals/Content/Personal moved to
// synced (Blob-backed) storage. LifeOS reads this once, client-side, to
// migrate any pre-existing browser data up to the server; see LifeOS.tsx.
export const LEGACY_LOCAL_STORAGE_KEY = "life-os:v1";

export function isEmptyStore(store: Store): boolean {
  return store.animals.length === 0 && store.content.length === 0 && store.personal.length === 0;
}

export function rid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export const SECTION_LABEL: Record<SectionKey, string> = {
  animals: "Animals",
  content: "Content",
  personal: "Personal",
};
