import {
  BookOpen,
  Info,
  Package,
  Tags,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import type { ProductMenuPromotion } from "@/features/catalog/categories/components/product-mega-menu";

export interface StorefrontNavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const primaryNavigationItems: StorefrontNavigationItem[] = [
  { label: "همهٔ محصولات", href: "/products", icon: Package },
  { label: "برندها", href: "/brands", icon: Tags },
  { label: "دستورها", href: "/recipes", icon: UtensilsCrossed },
  { label: "ژورنال", href: "/journal", icon: BookOpen },
  { label: "دربارهٔ ما", href: "/about", icon: Info },
];

export const productMenuPromotion: ProductMenuPromotion = {
  href: "/products",
  title: "منتخب رومرا",
  description: "تازه‌ترین انتخاب‌های فروشگاه را یک‌جا ببینید — یا از برندها شروع کنید.",
  ctaLabel: "همهٔ محصولات",
};

export const storefrontAnnouncement =
  "ارسال رایگان برای سفارش‌های بالای ۵٬۰۰۰٬۰۰۰ تومان — با ضمانت اصالت";
