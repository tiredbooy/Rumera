export const RANGES = [
  { id: "7d", label: "۷ روز", days: 7 },
  { id: "30d", label: "۳۰ روز", days: 30 },
  { id: "90d", label: "۹۰ روز", days: 90 },
] as const;

export type RangeId = (typeof RANGES)[number]["id"];

export function isValidRange(value: string | undefined): value is RangeId {
  return RANGES.some((r) => r.id === value);
}

export function daysFor(range: RangeId) {
  return RANGES.find((r) => r.id === range)!.days;
}

const DAY_MS = 86_400_000;

/** Current window for the given range. */
export function windowFor(range: RangeId) {
  const to = new Date();
  const from = new Date(to.getTime() - daysFor(range) * DAY_MS);
  return {
    date_from: from.toISOString().slice(0, 10),
    date_to: to.toISOString().slice(0, 10),
  };
}

/** The equally-sized window immediately preceding the current one, for trend comparison. */
export function previousWindowFor(range: RangeId) {
  const days = daysFor(range);
  const to = new Date(Date.now() - days * DAY_MS);
  const from = new Date(to.getTime() - days * DAY_MS);
  return {
    date_from: from.toISOString().slice(0, 10),
    date_to: to.toISOString().slice(0, 10),
  };
}
