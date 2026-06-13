/**
 * Sidebar navigation, declared once and filtered by permission at render time.
 *
 * Admin items carry a required `permission`; `filterNav` drops anything the
 * current session can't access, so each staff role automatically sees only the
 * sections it's allowed to use. Account items are permission-free (every
 * authenticated customer sees the full account menu).
 */
import {
  LayoutDashboard,
  Package,
  Boxes,
  ClipboardList,
  Users,
  Star,
  BookOpen,
  BarChart3,
  ShieldCheck,
  Settings,
  Home,
  ShoppingBag,
  MapPin,
  Heart,
  Wallet,
  MessageSquare,
  type LucideIcon,
} from "lucide-react"

import { PERMISSIONS, type Permission } from "./permissions"
import { can } from "./can"

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  /** Required permission; omit for always-visible items. */
  permission?: Permission
  /** Match the pathname exactly (for index links) instead of by prefix. */
  exact?: boolean
}

export type NavGroup = {
  title?: string
  items: NavItem[]
}

export const ADMIN_NAV: NavGroup[] = [
  {
    items: [{ label: "داشبورد", href: "/admin", icon: LayoutDashboard, exact: true }],
  },
  {
    title: "فروشگاه",
    items: [
      { label: "محصولات", href: "/admin/products", icon: Package, permission: PERMISSIONS.PRODUCTS_READ },
      { label: "موجودی", href: "/admin/inventory", icon: Boxes, permission: PERMISSIONS.INVENTORY_READ },
      { label: "سفارش‌ها", href: "/admin/orders", icon: ClipboardList, permission: PERMISSIONS.ORDERS_READ },
      { label: "مشتریان", href: "/admin/customers", icon: Users, permission: PERMISSIONS.CUSTOMERS_READ },
    ],
  },
  {
    title: "محتوا",
    items: [
      { label: "دیدگاه‌ها", href: "/admin/reviews", icon: Star, permission: PERMISSIONS.REVIEWS_READ },
      { label: "دستورها", href: "/admin/recipes", icon: BookOpen, permission: PERMISSIONS.RECIPES_READ },
    ],
  },
  {
    title: "سیستم",
    items: [
      { label: "تحلیل‌ها", href: "/admin/analytics", icon: BarChart3, permission: PERMISSIONS.ANALYTICS_READ },
      { label: "نقش‌ها و دسترسی‌ها", href: "/admin/roles", icon: ShieldCheck, permission: PERMISSIONS.ROLES_MANAGE },
      { label: "تنظیمات", href: "/admin/settings", icon: Settings, permission: PERMISSIONS.SETTINGS_MANAGE },
    ],
  },
]

export const ACCOUNT_NAV: NavGroup[] = [
  {
    items: [
      { label: "نمای کلی", href: "/account", icon: Home, exact: true },
      { label: "سفارش‌های من", href: "/account/orders", icon: ShoppingBag },
      { label: "آدرس‌ها", href: "/account/addresses", icon: MapPin },
      { label: "علاقه‌مندی‌ها", href: "/account/wishlist", icon: Heart },
      { label: "کیف پول", href: "/account/wallet", icon: Wallet },
      { label: "دیدگاه‌های من", href: "/account/reviews", icon: MessageSquare },
      { label: "تنظیمات حساب", href: "/account/settings", icon: Settings },
    ],
  },
]

type SessionLike = { permissions?: Permission[] | null } | null | undefined

/** Returns the nav with permission-gated items removed and empty groups dropped. */
export function filterNav(groups: NavGroup[], session: SessionLike): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.permission || can(session, item.permission)),
    }))
    .filter((group) => group.items.length > 0)
}
