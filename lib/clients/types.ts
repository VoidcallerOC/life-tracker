export const STATUSES = ["Potential", "Pending", "Paid", "Lost"] as const;
export type Status = (typeof STATUSES)[number];

export const PIPELINE_STATUSES: Status[] = ["Potential", "Pending", "Paid"];

export type Client = {
  id: string;
  client: string;
  businessType: string;
  status: Status;
  contacted: boolean;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  quoted: number | null;
  deposit: number | null;
  paid: number | null;
  githubRepo: string;
  liveUrl: string;
  domain: string;
  nextAction: string;
  notes: string;
  lastContacted: string;
};

export function emptyClient(): Omit<Client, "id"> {
  return {
    client: "",
    businessType: "",
    status: "Potential",
    contacted: false,
    contactName: "",
    phone: "",
    email: "",
    address: "",
    quoted: null,
    deposit: null,
    paid: null,
    githubRepo: "",
    liveUrl: "",
    domain: "",
    nextAction: "",
    notes: "",
    lastContacted: "",
  };
}

export function isStatus(value: string): value is Status {
  return (STATUSES as readonly string[]).includes(value);
}
