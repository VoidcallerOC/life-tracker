import { LifeOS } from "@/components/LifeOS";
import { readClients } from "@/lib/clients/storage";
import { readStore } from "@/lib/lifeStore/storage";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [clients, store] = await Promise.all([readClients(), readStore()]);
  return <LifeOS initialClients={clients} initialStore={store} />;
}
