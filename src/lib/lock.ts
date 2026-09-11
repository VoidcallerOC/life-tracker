const GATE_KEY = "nicklife-gate";
const PEPPER = "life-os-v1";
const EXPECTED = "9dceb0bd7e9eb28f5b7bf765e2dd7c3850dd650321f68ff35c0273323adcf208";

async function digest(value: string): Promise<string> {
  const data = new TextEncoder().encode(`${value}:${PEPPER}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return same(window.localStorage.getItem(GATE_KEY) ?? "", EXPECTED);
  } catch {
    return false;
  }
}

export async function unlockWith(password: string): Promise<boolean> {
  const token = await digest(password.trim());
  if (!same(token, EXPECTED)) return false;
  window.localStorage.setItem(GATE_KEY, token);
  return true;
}

export function lockNow(): void {
  try {
    window.localStorage.removeItem(GATE_KEY);
  } catch {
    /* ignore */
  }
}
