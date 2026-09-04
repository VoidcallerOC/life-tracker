export type Priority = "High" | "Medium" | "Low";

export interface AnimalRow {
  id: string;
  name: string;
  species: string;
  enclosure: string;
  lastFed: string;      // yyyy-mm-dd
  lastCleaned: string;  // yyyy-mm-dd — enclosure/substrate maintenance
  nextCareDue: string;  // yyyy-mm-dd — drives overdue/soon/later coloring
  notes: string;
}

export interface ContentRow {
  id: string;
  task: string;
  type: string;
  deadline: string;
  status: string;
  platform: string;
  notes: string;
}

export interface PersonalRow {
  id: string;
  task: string;
  category: string;
  deadline: string;
  status: string;
  notes: string;
}

export interface Store {
  animals: AnimalRow[];
  content: ContentRow[];
  personal: PersonalRow[];
}

export type SectionKey = keyof Store;

export interface DashboardItem {
  section: string;
  task: string;
  deadline: string;
  notes: string;
  priority: Priority | "";
  stage: string;
  source: SectionKey | "clients";
  sourceId: string;
}
