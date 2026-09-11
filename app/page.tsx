import { redirect } from "next/navigation";
import { LifeOS } from "@/components/LifeOS";
import { readSnapshot } from "@/lib/db/repository";
import { databaseConfigured } from "@/lib/db/client";
import { currentSession } from "@/lib/session";
import { SetupNotice } from "@/components/setup-notice";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!(await currentSession())) redirect("/login");
  if (!databaseConfigured()) return <SetupNotice />;

  const snapshot = await readSnapshot();
  return <LifeOS initialSnapshot={snapshot} />;
}
