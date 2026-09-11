import "server-only";
import webpush from "web-push";
import { sql } from "@/lib/db/client";

/**
 * Web push delivery. VAPID keys identify this server to the push services;
 * generate a pair once with `npm run push:keys` and set them in the environment.
 */

export function pushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY?.trim() && process.env.VAPID_PRIVATE_KEY?.trim(),
  );
}

let configured = false;

function ensureConfigured(): void {
  if (configured) return;
  if (!pushConfigured()) throw new Error("VAPID keys are not configured");
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT?.trim() || "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY!.trim(),
    process.env.VAPID_PRIVATE_KEY!.trim(),
  );
  configured = true;
}

export type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count: number;
};

export async function saveSubscription(sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<void> {
  const db = sql();
  await db`
    INSERT INTO push_subscriptions (endpoint, p256dh, auth)
    VALUES (${sub.endpoint}, ${sub.keys.p256dh}, ${sub.keys.auth})
    ON CONFLICT (endpoint) DO UPDATE
      SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, failure_count = 0
  `;
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const db = sql();
  await db`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

/**
 * Sends to every registered device. A 404/410 from the push service means the
 * subscription is dead (app uninstalled, permission revoked), so it is deleted
 * rather than retried forever.
 */
export async function sendToAll(payload: PushPayload): Promise<{ sent: number; pruned: number }> {
  ensureConfigured();
  const db = sql();
  const subs = await db<PushSubscriptionRow[]>`
    SELECT endpoint, p256dh, auth, failure_count FROM push_subscriptions
  `;

  let sent = 0;
  let pruned = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
        sent += 1;
        await db`UPDATE push_subscriptions SET last_sent_at = now(), failure_count = 0 WHERE endpoint = ${sub.endpoint}`;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await removeSubscription(sub.endpoint);
          pruned += 1;
          return;
        }
        console.error("Push send failed", sub.endpoint, status);
        await db`UPDATE push_subscriptions SET failure_count = failure_count + 1 WHERE endpoint = ${sub.endpoint}`;
      }
    }),
  );

  return { sent, pruned };
}
