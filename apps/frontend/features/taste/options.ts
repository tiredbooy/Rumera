import type { TasteProfileOptions } from "./types"

export const tasteProfileOptions = {
  categories: [
    { value: "Whisky", label: "ویسکی", slug: "whisky" },
    { value: "Wine", label: "شراب", slug: "wine" },
    { value: "Champagne", label: "شامپاین", slug: "champagne" },
    { value: "Gin", label: "جین", slug: "gin" },
    { value: "Rum", label: "رام", slug: "rum" },
    { value: "Tequila", label: "تکیلا", slug: "tequila" },
    { value: "Vodka", label: "ودکا", slug: "vodka" },
  ],
  budgets: [
    { label: "تا ۵ میلیون", value: 5_000_000 },
    { label: "تا ۱۰ میلیون", value: 10_000_000 },
    { label: "تا ۲۰ میلیون", value: 20_000_000 },
    { label: "بدون محدودیت", value: 0 },
  ],
  flavors: ["ملایم", "خشک", "دودی", "میوه‌ای", "تلخ", "شیرین"],
  occasions: ["مهمانی", "هدیه", "لذت شخصی", "جشن"],
} as const satisfies TasteProfileOptions
