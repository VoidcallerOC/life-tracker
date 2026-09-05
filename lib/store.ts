"use client";
import type { Store, SectionKey } from "./types";

const KEY = "life-os:v1";

export const EMPTY: Store = { animals: [], content: [], personal: [] };

export function seed(): Store {
  return {
    animals: [],
    content: [
      {
        id: rid(),
        task: "Voidcaller launch teaser",
        type: "Content",
        deadline: "2026-09-05",
        status: "In progress",
        platform: "Instagram",
        notes: "Sample row",
      },
    ],
    personal: [
      {
        id: rid(),
        task: "Forge / Harris DNS — Cloudflare nameserver flip",
        category: "Ops",
        deadline: "2026-09-04",
        status: "Active",
        notes: "Contact: Adam / Seth",
      },
    ],
  };
}

export function load(): Store {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      const s = seed();
      save(s);
      return s;
    }
    const parsed = JSON.parse(raw) as Partial<Store>;
    return { ...EMPTY, ...parsed };
  } catch {
    return EMPTY;
  }
}

export function save(store: Store): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {}
}

export function rid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function clearAll(): Store {
  const empty = EMPTY;
  save(empty);
  return empty;
}

export const SECTION_LABEL: Record<SectionKey, string> = {
  animals: "Animals",
  content: "Content",
  personal: "Personal",
};
