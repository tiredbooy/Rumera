/**
 * Sidebar navigation, declared once and filtered by permission at render time.
 *
 * Admin items carry a frontend capability identifier. Only admins receive
 * capabilities; account items are permission-free.
 *
 * Groups follow the operator's day: today, daily work, catalogue, customers,
 * marketing/content, then setup (collapsed by default so a 768px-tall
 * viewport does not need an inner scrollbar).
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
  Bell,
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
  /** Pending-work count, applied at render from the S-1 work-queue totals. */
  badge?: number;
};

export type NavGroup = {
  /** Stable id for collapse state (localStorage). */
  id?: string;
  title?: string;
  items: NavItem[];
  /** Setup/infrequent groups can fold; daily work stays open. */
  collapsible?: boolean;
  defaultCollapsed?: boolean;
};

export const ADMIN_NAV: NavGroup[] = [
  {
    id: "today",
    title: "امروز",
    items: [
      { label: "داشبورد", href: "/admin", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    id: "daily",
    title: "کار روزانه",
    items: [
      {
        label: "سفارش‌ها",
        href: "/admin/orders",
        icon: ClipboardList,
        permission: PERMISSIONS.ORDERS_READ,
      },
      {
        label: "پرداخت‌ها",
        href: "/admin/payments",
        icon: CreditCard,
        permission: PERMISSIONS.PAYMENTS_READ,
      },
      {
        label: "دیدگاه‌ها",
        href: "/admin/reviews",
        icon: Star,
        permission: PERMISSIONS.REVIEWS_READ,
      },
      {
        label: "موجودی",
        href: "/admin/inventory",
        icon: Boxes,
        permission: PERMISSIONS.INVENTORY_READ,
      },
    ],
  },
  {
    id: "catalogue",
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
    id: "customers",
    title: "مشتریان",
    items: [
      {
        label: "کاربران",
        href: "/admin/customers",
        icon: Users,
        permission: PERMISSIONS.CUSTOMERS_READ,
      },
      {
        label: "باشگاه مشتریان",
        href: "/admin/loyalty",
        icon: Award,
        permission: PERMISSIONS.CUSTOMERS_READ,
      },
    ],
  },
  {
    id: "marketing",
    title: "بازاریابی و محتوا",
    items: [
      {
        label: "کدهای تخفیف",
        href: "/admin/coupons",
        icon: TicketPercent,
        permission: PERMISSIONS.COUPONS_MANAGE,
      },
      {
        label: "کارت هدیه",
        href: "/admin/gift-cards",
        icon: Gift,
        permission: PERMISSIONS.GIFT_CARDS_ISSUE,
      },
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
    ],
  },
  {
    id: "setup",
    title: "پیکربندی",
    collapsible: true,
    defaultCollapsed: true,
    items: [
      {
        label: "ارسال و مناطق",
        href: "/admin/shipping",
        icon: Truck,
        permission: PERMISSIONS.SHIPPING_MANAGE,
      },
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
      { label: "اعلان‌ها", href: "/account/alerts", icon: Bell },
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

/**
 * Copies pending-work counts onto matching items. Zero, null (fetch failed)
 * and missing keys leave the item unbadged — a failed count must not read as
 * "nothing waiting".
 */
export function applyNavBadges(
  groups: NavGroup[],
  badges: Readonly<Record<string, number | null | undefined>>,
): NavGroup[] {
  return groups.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      const count = badges[item.href];
      if (typeof count !== "number" || count <= 0) return item;
      return { ...item, badge: count };
    }),
  }));
}
