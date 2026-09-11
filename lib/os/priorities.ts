/**
 * The week pin — the short list that stays at the top of Do Now.
 *
 * This used to be a hardcoded array in this file, which meant changing the
 * week's focus required a code edit and a redeploy, and put client names and
 * phone numbers into the repository. It now lives in the `settings` table under
 * the `weekPin` key and is edited in the app.
 */

export const WEEK_PIN_SETTING = "weekPin";

export type PinTone = "overdue" | "soon" | "later";

export type PinnedItem = {
  id: string;
  title: string;
  detail: string;
  when: string;
  tone: PinTone;
};

export type WeekPin = {
  weekOf: string;
  intro: string;
  items: PinnedItem[];
};

export const EMPTY_WEEK_PIN: WeekPin = { weekOf: "", intro: "", items: [] };

const TONES: PinTone[] = ["overdue", "soon", "later"];

function asString(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

/** Settings are free-form JSON, so everything read back is validated. */
export function normalizeWeekPin(value: unknown): WeekPin {
  if (!value || typeof value !== "object") return EMPTY_WEEK_PIN;
  const raw = value as Partial<WeekPin>;
  const items = Array.isArray(raw.items) ? raw.items : [];

  return {
    weekOf: asString(raw.weekOf, 80),
    intro: asString(raw.intro, 500),
    items: items.slice(0, 10).map((item, index) => {
      const record = (item ?? {}) as Partial<PinnedItem>;
      const tone = TONES.includes(record.tone as PinTone) ? (record.tone as PinTone) : "later";
      return {
        id: asString(record.id, 100) || `pin-${index}`,
        title: asString(record.title, 200),
        detail: asString(record.detail, 1000),
        when: asString(record.when, 60),
        tone,
      };
    }),
  };
}

export function isWeekPinEmpty(pin: WeekPin): boolean {
  return pin.items.length === 0 && !pin.intro.trim();
}
