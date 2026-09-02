"use client";
import type { Store, SectionKey } from "./types";

const KEY = "life-os:v1";

export const EMPTY: Store = { saas: [], animals: [], content: [], personal: [] };

export function seed(): Store {
  return {
    saas: [
      {
        id: rid(),
        project: "Front Window / Harris DNS",
        stage: "Active",
        deadline: "2026-09-04",
        clientContact: "Adam / Seth",
        notes: "Cloudflare nameserver flip",
        followUpDate: "2026-09-03",
        priority: "High",
      },
      {
        id: rid(),
        project: "ETC walk follow-up",
        stage: "Pending",
        deadline: "2026-09-07",
        clientContact: "Comics ETC",
        notes: "Collection intake",
        followUpDate: "2026-09-07",
        priority: "Medium",
      },
    ],
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
    personal: [],
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
  saas: "SaaS",
  animals: "Animals",
  content: "Content",
  personal: "Personal",
};
