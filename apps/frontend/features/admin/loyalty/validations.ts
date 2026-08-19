import { z } from "zod";
import { toAsciiDigits } from "@/lib/normalize-digits";
import { LOYALTY_REASON_FA } from "@/features/loyalty/reasons";
import type { LoyaltyTier } from "@/features/loyalty/types";

import { LOYALTY_TIER_IDS } from "./labels";
import type {
  LoyaltyLedgerFilters,
  LoyaltyMemberDetailSearchParams,
  LoyaltyMemberFilters,
  LoyaltyMemberListQuery,
  LoyaltyMemberSearchParams,
  LoyaltyMemberSort,
  LoyaltyProgramme,
  UpdateLoyaltyProgrammeInput,
} from "./types";

const tierSchema = z.enum(LOYALTY_TIER_IDS);
const loyaltyMemberUserIDSchema = z.string().uuid();

export function parseLoyaltyMemberUserID(value: string): string | null {
  const parsed = loyaltyMemberUserIDSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function parsePage(value: string | string[] | undefined): number {
  const parsed = z.coerce.number().int().positive().safeParse(first(value));
  return parsed.success ? parsed.data : 1;
}

const MEMBER_SORTS = [
  "newest",
  "oldest",
  "balance_desc",
  "balance_asc",
  "tier_desc",
  "tier_asc",
] as const satisfies readonly LoyaltyMemberSort[];

export function parseLoyaltyMemberSort(
  value: string | string[] | undefined,
): LoyaltyMemberSort {
  const sort = first(value);
  return MEMBER_SORTS.includes(sort as LoyaltyMemberSort)
    ? (sort as LoyaltyMemberSort)
    : "newest";
}

export function parseLoyaltyMemberFilters(
  searchParams: LoyaltyMemberSearchParams,
): LoyaltyMemberFilters {
  const parsedTier = tierSchema.safeParse(first(searchParams.tier));
  return {
    query: toAsciiDigits(first(searchParams.q)).trim().slice(0, 200),
    page: parsePage(searchParams.page),
    tier: parsedTier.success ? (parsedTier.data as LoyaltyTier) : undefined,
    sort: parseLoyaltyMemberSort(searchParams.sort),
  };
}

export function toLoyaltyMemberListQuery(
  filters: LoyaltyMemberFilters,
  limit: number,
): LoyaltyMemberListQuery {
  const sort =
    filters.sort === "oldest"
      ? { sortBy: "updated_at" as const, orderBy: "asc" as const }
      : filters.sort === "balance_desc"
        ? { sortBy: "points_balance" as const, orderBy: "desc" as const }
        : filters.sort === "balance_asc"
          ? { sortBy: "points_balance" as const, orderBy: "asc" as const }
          : filters.sort === "tier_desc"
            ? { sortBy: "tier" as const, orderBy: "desc" as const }
            : filters.sort === "tier_asc"
              ? { sortBy: "tier" as const, orderBy: "asc" as const }
              : { sortBy: "updated_at" as const, orderBy: "desc" as const };
  return {
    page: filters.page,
    limit,
    q: filters.query || undefined,
    tier: filters.tier,
    ...sort,
  };
}

export function parseLoyaltyLedgerPage(
  searchParams: LoyaltyMemberDetailSearchParams,
): number {
  return parsePage(searchParams.page);
}

export function parseLoyaltyLedgerFilters(
  searchParams: LoyaltyMemberDetailSearchParams,
): LoyaltyLedgerFilters {
  const reason = first(searchParams.reason).trim();
  return {
    page: parsePage(searchParams.page),
    reason: reason && reason in LOYALTY_REASON_FA ? reason : undefined,
  };
}
// ── L-1: programme editor ────────────────────────────────────────────────────

/** Ascending, matching the server's strictly-increasing threshold rule. */
export const TIER_ORDER = ["bronze", "silver", "gold", "cellar"] as const;
export { LOYALTY_TIER_FA as TIER_FA } from "./labels";

/**
 * Validates a numeric text field without transforming it: the form keeps
 * strings so react-hook-form's input and output types stay identical (the
 * coupon form does the same); conversion happens in the mapper below.
 */
function numberField(opts: { min?: number; gt?: number; label: string }) {
  return z
    .string()
    .trim()
    .min(1, `${opts.label} الزامی است`)
    .refine((v) => /^\d+(\.\d+)?$/.test(v), `${opts.label} باید عدد باشد`)
    .refine(
      (v) => (opts.gt === undefined ? true : Number(v) > opts.gt),
      `${opts.label} باید بزرگ‌تر از ${opts.gt} باشد`,
    )
    .refine(
      (v) => (opts.min === undefined ? true : Number(v) >= opts.min),
      `${opts.label} نمی‌تواند منفی باشد`,
    );
}

/**
 * Mirrors the server rules (loyalty/service.go validateProgrammeUpdate and
 * validateProgrammeTiers) so an operator sees the problem before the round
 * trip. The server remains the authority — this never relaxes anything.
 */
export const loyaltyProgrammeFormSchema = z
  .object({
    // L-2: the kill switch. Server-side `enabled` is validated as required,
    // so it is a real field here rather than a value threaded past the form.
    enabled: z.boolean(),
    earn_divisor: numberField({ gt: 0, label: "مبلغ خرید به ازای هر امتیاز" }),
    redeem_value: numberField({ gt: 0, label: "ارزش هر امتیاز" }),
    signup_bonus: numberField({ min: 0, label: "هدیهٔ عضویت" }),
    review_bonus: numberField({ min: 0, label: "هدیهٔ نظر" }),
    birthday_bonus: numberField({ min: 0, label: "هدیهٔ تولد" }),
    referral_reward: numberField({ min: 0, label: "پاداش معرفی" }),
    birthday_tz: z.string().trim().min(1, "منطقهٔ زمانی الزامی است"),
    tier_bronze: numberField({ min: 0, label: "آستانهٔ برنز" }),
    tier_silver: numberField({ min: 0, label: "آستانهٔ نقره‌ای" }),
    tier_gold: numberField({ min: 0, label: "آستانهٔ طلایی" }),
    tier_cellar: numberField({ min: 0, label: "آستانهٔ سرداب" }),
  })
  .superRefine((values, ctx) => {
    // Bronze is the entry tier; the server pins it at 0 and rejects anything else.
    if (Number(values.tier_bronze) !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tier_bronze"],
        message: "آستانهٔ برنز باید صفر باشد",
      });
    }
    const ordered = [
      ["tier_silver", values.tier_silver, values.tier_bronze],
      ["tier_gold", values.tier_gold, values.tier_silver],
      ["tier_cellar", values.tier_cellar, values.tier_gold],
    ] as const;
    for (const [path, value, previous] of ordered) {
      if (Number(value) <= Number(previous)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [path],
          message: "هر آستانه باید از سطح پیش از خود بزرگ‌تر باشد",
        });
      }
    }
  });

export type LoyaltyProgrammeFormValues = z.infer<
  typeof loyaltyProgrammeFormSchema
>;

export function loyaltyProgrammeFormDefaults(
  programme: LoyaltyProgramme,
): LoyaltyProgrammeFormValues {
  const threshold = (id: string) =>
    String(programme.tiers.find((t) => t.id === id)?.min_lifetime_points ?? 0);
  return {
    enabled: programme.enabled,
    earn_divisor: String(programme.earn_divisor),
    redeem_value: String(programme.redeem_value),
    signup_bonus: String(programme.signup_bonus),
    review_bonus: String(programme.review_bonus),
    birthday_bonus: String(programme.birthday_bonus),
    referral_reward: String(programme.referral_reward),
    birthday_tz: programme.birthday_tz,
    tier_bronze: threshold("bronze"),
    tier_silver: threshold("silver"),
    tier_gold: threshold("gold"),
    tier_cellar: threshold("cellar"),
  };
}

/**
 * The PUT is a full replace, so every lever — `enabled` included — is sent on
 * each save; the server validates it as required and a dropped one is a 422.
 */
export function toUpdateLoyaltyProgrammeInput(
  values: LoyaltyProgrammeFormValues,
): UpdateLoyaltyProgrammeInput {
  return {
    enabled: values.enabled,
    earn_divisor: Number(values.earn_divisor),
    redeem_value: Number(values.redeem_value),
    signup_bonus: Number(values.signup_bonus),
    review_bonus: Number(values.review_bonus),
    birthday_bonus: Number(values.birthday_bonus),
    referral_reward: Number(values.referral_reward),
    birthday_tz: values.birthday_tz.trim(),
    tiers: TIER_ORDER.map((id) => ({
      id,
      min_lifetime_points: Number(values[`tier_${id}` as const]),
    })),
  };
}
