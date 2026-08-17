import { z } from "zod";

import type { CreateGiftCardsInput } from "@/features/gift-cards/types";
import { parseAsciiNumber, toAsciiDigits } from "@/lib/normalize-digits";

const MAX_INTEGER_DIGITS = 18;
export const MAX_GIFT_CARD_BATCH_SIZE = 500;

export const giftCardIssuanceSchema = z.object({
  amount: z
    .string()
    .trim()
    .min(1, "مبلغ کارت هدیه الزامی است")
    .refine(
      (value) =>
        new RegExp(`^\\d{1,${MAX_INTEGER_DIGITS}}(?:\\.\\d{1,2})?$`).test(
          toAsciiDigits(value),
        ),
      "مبلغ باید عددی مثبت با حداکثر دو رقم اعشار باشد",
    )
    .refine(
      (value) => !/^0+(?:\.0+)?$/.test(toAsciiDigits(value)),
      "مبلغ باید بیشتر از صفر باشد",
    ),
  count: z
    .string()
    .trim()
    .refine((value) => /^\d+$/.test(toAsciiDigits(value)), {
      message: "تعداد باید عدد صحیح باشد",
    })
    .refine((value) => {
      const count = parseAsciiNumber(value);
      return count >= 1 && count <= MAX_GIFT_CARD_BATCH_SIZE;
    }, "تعداد باید بین ۱ تا ۵۰۰ باشد"),
});

export type GiftCardIssuanceValues = z.infer<typeof giftCardIssuanceSchema>;

export function toCreateGiftCardsInput(
  values: GiftCardIssuanceValues,
): CreateGiftCardsInput {
  return {
    amount: toAsciiDigits(values.amount).trim(),
    count: parseAsciiNumber(values.count),
  };
}
