import type { ContentRow, PersonalRow } from "@/lib/types";

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Operating cadence for the week of 2026-09-05. */
export const WEEK_OF = "Week of Sep 5, 2026";

export const PINNED = [
  {
    id: "close-salem",
    title: "Close Salem Comics",
    detail: "Dillon already wants a site. Flex price. Do not add new names until this is yes or no.",
    when: "Today",
    tone: "overdue" as const,
  },
  {
    id: "care-plans",
    title: "Care plan + referral on live shops",
    detail: "M&J, Thousand Sunny, Hard Hittin, Harris. Drafts are in Gmail. Text/IG the ones without email.",
    when: "Today",
    tone: "overdue" as const,
  },
  {
    id: "voidcaller-teaser",
    title: "Post the Voidcaller Chapter I teaser",
    detail: "Copy is written. Post from @VoidcallerOC before the week disappears.",
    when: "Today",
    tone: "soon" as const,
  },
  {
    id: "card-loop",
    title: "Card-shop loop only",
    detail: "#02 Infinite Heroes → #03 IDeal → #04 Comics EH → #05 Imperial → #06 EC3. No antiques, pawn, or mall shops this week.",
    when: "Mon–Wed",
    tone: "soon" as const,
  },
  {
    id: "southington-walk",
    title: "Southington drop-in",
    detail: "Leather Jacket Games + Enchanted Violet while you’re already in town for M&J / Hard Hittin.",
    when: "This week",
    tone: "later" as const,
  },
];

export const PRIORITY_PERSONAL: PersonalRow[] = [
  {
    id: "prio-salem",
    task: "#01 Close Salem Comics (Dillon)",
    category: "Priority",
    deadline: iso(2026, 9, 5),
    status: "Todo",
    notes: "Flex pricing. He wants site + branding. Do not skip for new cold calls.",
  },
  {
    id: "prio-care-plans",
    task: "Send care plan + referral to live Forge shops",
    category: "Priority",
    deadline: iso(2026, 9, 5),
    status: "Todo",
    notes: "M&J email draft ready. TS / Hard Hittin / Harris — text or IG.",
  },
  {
    id: "prio-infinite",
    task: "#02 Call Infinite Heroes (Paul)",
    category: "Priority",
    deadline: iso(2026, 9, 8),
    status: "Todo",
    notes: "Watertown. Site loads blank. (860) 417-2559.",
  },
  {
    id: "prio-ideal",
    task: "#03 Call IDeal Cards (Alix)",
    category: "Priority",
    deadline: iso(2026, 9, 8),
    status: "Todo",
    notes: "Terryville. No site. Sports cards / memorabilia. (860) 973-3037.",
  },
  {
    id: "prio-comics-eh",
    task: "#04 Pitch Comics and Collectibles Etc",
    category: "Priority",
    deadline: iso(2026, 9, 9),
    status: "Todo",
    notes: "East Hartford. No real site. (860) 726-4787.",
  },
  {
    id: "prio-imperial-ec3",
    task: "#05–#06 Imperial Gaming + EC3",
    category: "Priority",
    deadline: iso(2026, 9, 10),
    status: "Todo",
    notes: "Check imperialgamingtcg.com first. EC3 is shop + Mohegan con.",
  },
];

export const PRIORITY_CONTENT: ContentRow[] = [
  {
    id: "prio-voidcaller-teaser",
    task: "Post Voidcaller Chapter I teaser",
    type: "Social",
    deadline: iso(2026, 9, 5),
    status: "Todo",
    platform: "X",
    notes: "From @VoidcallerOC. Copy is in Grok artifacts / earlier chat.",
  },
];

export function mergePriorityRows<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const ids = new Set(incoming.map((row) => row.id));
  const kept = existing.filter((row) => !ids.has(row.id));
  return [...incoming, ...kept];
}
