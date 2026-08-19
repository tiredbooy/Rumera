/**
 * Frontend capability catalogue used to organize admin navigation and actions.
 * Keep in sync with apps/backend/internal/features/rbac/model.go.
 * Server enforces the same identifiers via RequirePermission middleware.
 */

export const PERMISSIONS = {
  // Catalogue
  PRODUCTS_READ: "products:read",
  PRODUCTS_WRITE: "products:write",
  PRODUCTS_DELETE: "products:delete",
  TAGS_MANAGE: "tags:manage",
  // Inventory & stock
  INVENTORY_READ: "inventory:read",
  INVENTORY_WRITE: "inventory:write",
  // Orders
  ORDERS_READ: "orders:read",
  ORDERS_WRITE: "orders:write",
  ORDERS_REFUND: "orders:refund",
  PAYMENTS_READ: "payments:read",
  COUPONS_MANAGE: "coupons:manage",
  SHIPPING_MANAGE: "shipping:manage",
  GIFT_CARDS_ISSUE: "gift-cards:issue",
  // Customers
  CUSTOMERS_READ: "customers:read",
  CUSTOMERS_WRITE: "customers:write",
  CUSTOMERS_BAN: "customers:ban",
  WALLET_CREDIT: "wallet:credit",
  /** Mints loyalty points. Isolated from customers:write like wallet:credit (L-8). */
  LOYALTY_ADJUST: "loyalty:adjust",
  // Reviews / moderation
  REVIEWS_READ: "reviews:read",
  REVIEWS_MODERATE: "reviews:moderate",
  // Recipes (editorial)
  RECIPES_READ: "recipes:read",
  RECIPES_WRITE: "recipes:write",
  JOURNAL_READ: "journal:read",
  JOURNAL_WRITE: "journal:write",
  // Hero / home carousel (editorial)
  HERO_MANAGE: "hero:manage",
  // Analytics
  ANALYTICS_READ: "analytics:read",
  // Platform administration
  ROLES_MANAGE: "roles:manage",
  SETTINGS_MANAGE: "settings:manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Persian labels for frontend capability identifiers. */
export const PERMISSION_LABELS: Record<Permission, string> = {
  "products:read": "مشاهدهٔ محصولات",
  "products:write": "ویرایش محصولات",
  "products:delete": "حذف محصولات",
  "tags:manage": "مدیریت برچسب‌ها",
  "inventory:read": "مشاهدهٔ موجودی",
  "inventory:write": "ویرایش موجودی",
  "orders:read": "مشاهدهٔ سفارش‌ها",
  "orders:write": "مدیریت سفارش‌ها",
  "orders:refund": "بازپرداخت سفارش",
  "payments:read": "مشاهدهٔ پرداخت‌ها",
  "coupons:manage": "مدیریت کدهای تخفیف",
  "shipping:manage": "مدیریت ارسال",
  "gift-cards:issue": "صدور کارت هدیه",
  "customers:read": "مشاهدهٔ مشتریان",
  "customers:write": "ویرایش مشتریان",
  "customers:ban": "مسدودسازی مشتری",
  "wallet:credit": "افزایش موجودی کیف پول",
  "loyalty:adjust": "تنظیم امتیاز باشگاه",
  "reviews:read": "مشاهدهٔ دیدگاه‌ها",
  "reviews:moderate": "بازبینی دیدگاه‌ها",
  "recipes:read": "مشاهدهٔ دستورها",
  "recipes:write": "ویرایش دستورها",
  "journal:read": "مشاهدهٔ ژورنال",
  "journal:write": "ویرایش ژورنال",
  "hero:manage": "مدیریت بنر هیرو",
  "analytics:read": "مشاهدهٔ تحلیل‌ها",
  "roles:manage": "مدیریت نقش‌ها و دسترسی‌ها",
  "settings:manage": "مدیریت تنظیمات",
};
