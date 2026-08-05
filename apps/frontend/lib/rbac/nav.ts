/**
 * Sidebar navigation, declared once and filtered by permission at render time.
 *
 * Admin items carry a frontend capability identifier. Only admins receive
 * capabilities; account items are permission-free.
 *
 * Groups are job-based so operators scan by work type (catalogue, commerce,
 * content, insights, system) rather than a mixed flat list.
 */
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Tag,
  Tags,
  Layers,
  Boxes,
  ClipboardList,
  Users,
  Star,
  BookOpen,
  Newspaper,
  GalleryHorizontalEnd,
  BarChart3,
  Activity,
  ShieldCheck,
  Settings,
  Home,
  ShoppingBag,
  MapPin,
  Heart,
  Wallet,
  MessageSquare,
  Sparkles,
  Award,
  Repeat,
  CreditCard,
  Gift,
  TicketPercent,
  Truck,
  type LucideIcon,
} from "lucide-react";

import { PERMISSIONS, type Permission } from "./permissions";
import { can } from "./can";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Required permission; omit for always-visible items. */
  permission?: Permission;
  /** Match the pathname exactly (for index links) instead of by prefix. */
  exact?: boolean;
};

export type NavGroup = {
  title?: string;
  items: NavItem[];
};

export const ADMIN_NAV: NavGroup[] = [
  {
    items: [
      { label: "داشبورد", href: "/admin", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    title: "کاتالوگ",
    items: [
      {
        label: "محصولات",
        href: "/admin/products",
        icon: Package,
        permission: PERMISSIONS.PRODUCTS_READ,
      },
      {
        label: "دسته‌بندی‌ها",
        href: "/admin/categories",
        icon: FolderTree,
        permission: PERMISSIONS.PRODUCTS_READ,
      },
      {
        label: "برندها",
        href: "/admin/brands",
        icon: Tag,
        permission: PERMISSIONS.PRODUCTS_READ,
      },
      {
        label: "برچسب‌ها",
        href: "/admin/tags",
        icon: Tags,
        permission: PERMISSIONS.TAGS_MANAGE,
      },
      {
        label: "ویژگی‌های تنوع",
        href: "/admin/options",
        icon: Layers,
        permission: PERMISSIONS.PRODUCTS_WRITE,
      },
    ],
  },
  {
    title: "موجودی و سفارش",
    items: [
      {
        label: "موجودی",
        href: "/admin/inventory",
        icon: Boxes,
        permission: PERMISSIONS.INVENTORY_READ,
      },
      {
        label: "سفارش‌ها",
        href: "/admin/orders",
        icon: ClipboardList,
        permission: PERMISSIONS.ORDERS_READ,
      },
    ],
  },
  {
    title: "مشتریان",
    items: [
      {
        label: "کاربران",
        href: "/admin/customers",
        icon: Users,
        permission: PERMISSIONS.CUSTOMERS_READ,
      },
    ],
  },
  {
    title: "فروش و لجستیک",
    items: [
      {
        label: "پرداخت‌ها",
        href: "/admin/payments",
        icon: CreditCard,
        permission: PERMISSIONS.PAYMENTS_READ,
      },
      {
        label: "کدهای تخفیف",
        href: "/admin/coupons",
        icon: TicketPercent,
        permission: PERMISSIONS.COUPONS_MANAGE,
      },
      {
        label: "ارسال و مناطق",
        href: "/admin/shipping",
        icon: Truck,
        permission: PERMISSIONS.SHIPPING_MANAGE,
      },
      {
        label: "کارت هدیه",
        href: "/admin/gift-cards",
        icon: Gift,
        permission: PERMISSIONS.GIFT_CARDS_ISSUE,
      },
    ],
  },
  {
    title: "محتوا",
    items: [
      {
        label: "ژورنال",
        href: "/admin/journal",
        icon: Newspaper,
        permission: PERMISSIONS.JOURNAL_READ,
      },
      {
        label: "دستورها",
        href: "/admin/recipes",
        icon: BookOpen,
        permission: PERMISSIONS.RECIPES_READ,
      },
      {
        label: "بنر هیرو",
        href: "/admin/hero-slides",
        icon: GalleryHorizontalEnd,
        permission: PERMISSIONS.HERO_MANAGE,
      },
      {
        label: "دیدگاه‌ها",
        href: "/admin/reviews",
        icon: Star,
        permission: PERMISSIONS.REVIEWS_READ,
      },
    ],
  },
  {
    title: "بینش و پایش",
    items: [
      {
        label: "تحلیل‌ها",
        href: "/admin/analytics",
        icon: BarChart3,
        permission: PERMISSIONS.ANALYTICS_READ,
      },
      {
        label: "توصیه‌گر",
        href: "/admin/recommendations",
        icon: Sparkles,
        permission: PERMISSIONS.ANALYTICS_READ,
      },
      {
        label: "مانیتورینگ API",
        href: "/admin/monitoring",
        icon: Activity,
        permission: PERMISSIONS.ANALYTICS_READ,
      },
    ],
  },
  {
    title: "سیستم",
    items: [
      {
        label: "نقش‌ها و دسترسی‌ها",
        href: "/admin/roles",
        icon: ShieldCheck,
        permission: PERMISSIONS.ROLES_MANAGE,
      },
      {
        label: "تنظیمات",
        href: "/admin/settings",
        icon: Settings,
        permission: PERMISSIONS.SETTINGS_MANAGE,
      },
    ],
  },
];

export const ACCOUNT_NAV: NavGroup[] = [
  {
    title: "نمای کلی",
    items: [
      { label: "نمای کلی", href: "/account", icon: Home, exact: true },
      { label: "سفارش‌های من", href: "/account/orders", icon: ShoppingBag },
      { label: "علاقه‌مندی‌ها", href: "/account/wishlist", icon: Heart },
    ],
  },
  {
    title: "حساب و آدرس",
    items: [
      { label: "آدرس‌ها", href: "/account/addresses", icon: MapPin },
      { label: "کیف پول", href: "/account/wallet", icon: Wallet },
      { label: "تنظیمات حساب", href: "/account/settings", icon: Settings },
    ],
  },
  {
    title: "تجربه و وفاداری",
    items: [
      { label: "سلیقهٔ من", href: "/account/taste", icon: Sparkles },
      { label: "باشگاه مشتریان", href: "/account/rewards", icon: Award },
      { label: "اشتراک‌ها", href: "/account/subscriptions", icon: Repeat },
      { label: "دیدگاه‌های من", href: "/account/reviews", icon: MessageSquare },
    ],
  },
];

type SessionLike = { permissions?: Permission[] | null } | null | undefined;

/** Returns the nav with permission-gated items removed and empty groups dropped. */
export function filterNav(
  groups: NavGroup[],
  session: SessionLike,
): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.permission || can(session, item.permission),
      ),
    }))
    .filter((group) => group.items.length > 0);
}
