export const SESSION_COOKIE = "lo_session";

function authPassword(): string | undefined {
  const key = ["AUTH", "PASSWORD"].join("_");
  const value = process.env[key];
  return value && value.length > 0 ? value : undefined;
}

export async function sessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`${password}:life-os-v1`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export function expectedPassword(): string {
  const password = authPassword();
  if (!password) {
    throw new Error("AUTH_PASSWORD is not set");
  }
  return password;
}

export async function expectedSessionToken(): Promise<string> {
  return sessionToken(expectedPassword());
}

export async function isValidSession(
  cookieValue: string | undefined,
): Promise<boolean> {
  if (!cookieValue) return false;
  let expected: string;
  try {
    expected = await expectedSessionToken();
  } catch {
    return false;
  }
  if (cookieValue.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= cookieValue.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export function isAuthorizedRequest(request: Request): boolean {
  const url = new URL(request.url);
  const key = request.headers.get("x-summary-key") ?? url.searchParams.get("key");
  if (!key) return false;
  let expected: string;
  try {
    expected = expectedPassword();
  } catch {
    return false;
  }
  if (key.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= key.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
