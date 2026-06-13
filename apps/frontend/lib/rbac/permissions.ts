/**
 * Permission catalogue — the single source of truth for what can be done in the
 * app. Mirrors the backend `permissions` table, where every row is a
 * `resource:action` pair (see
 * `apps/backend/migrations/main/20260525210307_create_permissions_table.sql`).
 *
 * The admin surface scales by adding a permission here, gating the page with
 * `requirePermission`, and tagging its nav entry — nothing else.
 */

export const PERMISSIONS = {
  // Catalogue
  PRODUCTS_READ: "products:read",
  PRODUCTS_WRITE: "products:write",
  PRODUCTS_DELETE: "products:delete",
  // Inventory & stock
  INVENTORY_READ: "inventory:read",
  INVENTORY_WRITE: "inventory:write",
  // Orders
  ORDERS_READ: "orders:read",
  ORDERS_WRITE: "orders:write",
  ORDERS_REFUND: "orders:refund",
  // Customers
  CUSTOMERS_READ: "customers:read",
  CUSTOMERS_WRITE: "customers:write",
  CUSTOMERS_BAN: "customers:ban",
  // Reviews / moderation
  REVIEWS_READ: "reviews:read",
  REVIEWS_MODERATE: "reviews:moderate",
  // Recipes (editorial)
  RECIPES_READ: "recipes:read",
  RECIPES_WRITE: "recipes:write",
  // Analytics
  ANALYTICS_READ: "analytics:read",
  // Platform administration
  ROLES_MANAGE: "roles:manage",
  SETTINGS_MANAGE: "settings:manage",
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

/** Persian, human-readable labels for the RBAC admin screen. */
export const PERMISSION_LABELS: Record<Permission, string> = {
  "products:read": "مشاهدهٔ محصولات",
  "products:write": "ویرایش محصولات",
  "products:delete": "حذف محصولات",
  "inventory:read": "مشاهدهٔ موجودی",
  "inventory:write": "ویرایش موجودی",
  "orders:read": "مشاهدهٔ سفارش‌ها",
  "orders:write": "مدیریت سفارش‌ها",
  "orders:refund": "بازپرداخت سفارش",
  "customers:read": "مشاهدهٔ مشتریان",
  "customers:write": "ویرایش مشتریان",
  "customers:ban": "مسدودسازی مشتری",
  "reviews:read": "مشاهدهٔ دیدگاه‌ها",
  "reviews:moderate": "بازبینی دیدگاه‌ها",
  "recipes:read": "مشاهدهٔ دستورها",
  "recipes:write": "ویرایش دستورها",
  "analytics:read": "مشاهدهٔ تحلیل‌ها",
  "roles:manage": "مدیریت نقش‌ها و دسترسی‌ها",
  "settings:manage": "مدیریت تنظیمات",
}
