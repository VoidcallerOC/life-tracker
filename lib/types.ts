export type Priority = "High" | "Medium" | "Low";
export type Stage = "Active" | "Pending" | "Blocked" | "Done";

export interface SaaSRow {
  id: string;
  project: string;
  stage: Stage;
  deadline: string;         // yyyy-mm-dd
  clientContact: string;
  notes: string;
  followUpDate: string;     // yyyy-mm-dd
  priority: Priority;
}

export interface AnimalRow {
  id: string;
  animalId: string;
  species: string;
  stage: Stage;
  buyer: string;
  saleDate: string;
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
  saas: SaaSRow[];
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
  source: SectionKey;
  sourceId: string;
}
