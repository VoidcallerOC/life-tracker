"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/os/ui/button";

/** Converts a base64url VAPID key into the Uint8Array the Push API expects. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

type State = "loading" | "unsupported" | "unconfigured" | "off" | "on" | "denied";

/**
 * Subscribes this device to overdue-care notifications. This is the piece that
 * makes the app tell you something is due instead of waiting to be opened.
 */
export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
        if (!cancelled) setState("unsupported");
        return;
      }

      const response = await fetch("/api/push/subscribe", { credentials: "same-origin" }).catch(
        () => null,
      );
      const config = (await response?.json().catch(() => null)) as
        | { configured?: boolean; publicKey?: string | null }
        | null;

      if (cancelled) return;
      if (!config?.configured || !config.publicKey) {
        setState("unconfigured");
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }

      const registration = await navigator.serviceWorker.getRegistration();
      const existing = await registration?.pushManager.getSubscription();
      if (!cancelled) setState(existing ? "on" : "off");
    }

    void detect();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }

      const config = (await (
        await fetch("/api/push/subscribe", { credentials: "same-origin" })
      ).json()) as { publicKey: string };

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey) as BufferSource,
      });

      const saved = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!saved.ok) throw new Error("Could not register this device");

      setState("on");
      toast("This device will be notified when care is overdue.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not turn on notifications");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
          method: "DELETE",
          credentials: "same-origin",
        });
        await subscription.unsubscribe();
      }
      setState("off");
      toast("Notifications off for this device.");
    } catch {
      toast.error("Could not turn notifications off");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") return null;

  if (state === "unsupported") {
    return (
      <p className="text-xs text-muted">
        This browser cannot do notifications. On iPhone, add the app to your Home Screen first.
      </p>
    );
  }

  if (state === "unconfigured") {
    return (
      <p className="text-xs text-muted">
        Notifications need VAPID keys. Run <code>npm run push:keys</code> and set them in the
        environment.
      </p>
    );
  }

  if (state === "denied") {
    return (
      <p className="text-xs text-muted">
        Notifications are blocked for this site. Re-enable them in your browser settings.
      </p>
    );
  }

  return (
    <Button
      variant={state === "on" ? "secondary" : "primary"}
      className="w-full"
      disabled={busy}
      onClick={() => (state === "on" ? disable() : enable())}
    >
      {busy
        ? "Working…"
        : state === "on"
          ? "Turn off notifications on this device"
          : "Notify me when care is overdue"}
    </Button>
  );
}
