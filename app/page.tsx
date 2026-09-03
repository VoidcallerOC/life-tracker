import { LifeOS } from "@/components/LifeOS";
import { readClients } from "@/lib/clients/storage";

export const dynamic = "force-dynamic";

export default async function Page() {
  const clients = await readClients();
  return <LifeOS initialClients={clients} />;
}
