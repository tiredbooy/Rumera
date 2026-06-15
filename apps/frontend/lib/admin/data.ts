/**
 * Admin mock-data layer.
 *
 * A single, richly-typed sample dataset that powers every admin screen so the
 * panel is fully demoable before the backend is wired. Every export here is a
 * stand-in for a `GET /api/v1/admin/*` call — replace the bodies with React
 * Query hooks (see `lib/api/admin-hooks.ts`) once the endpoints exist; the page
 * components consume the types, not the literals, so the swap stays local.
 *
 * Persian dates are stored as display strings (Jalali) to keep the mock
 * deterministic and free of date math. Money is Toman, formatted with
 * `formatPrice` from `@/lib/products`.
 */
import { products, type Product, type Category } from "@/lib/products"

/* -------------------------------------------------------------------------- */
/*  Status vocabularies (shared with status-badge.tsx)                         */
/* -------------------------------------------------------------------------- */

export type PaymentStatus = "paid" | "pending" | "refunded" | "failed"
export type FulfilmentStatus =
  | "processing"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled"
export type StockStatus = "in_stock" | "low" | "out"
export type ReviewStatus = "pending" | "approved" | "rejected"
export type RecipeStatus = "draft" | "published"
export type CustomerStatus = "active" | "banned"
export type LoyaltyTier = "bronze" | "silver" | "gold" | "platinum"

/* -------------------------------------------------------------------------- */
/*  Orders                                                                     */
/* -------------------------------------------------------------------------- */

export type OrderLine = {
  productId: string
  name: string
  qty: number
  price: number
}

export type OrderEvent = {
  label: string
  at: string
  done: boolean
}

export type AdminOrder = {
  id: string
  number: number
  customerId: string
  customerName: string
  customerEmail: string
  date: string
  itemsCount: number
  subtotal: number
  shipping: number
  discount: number
  total: number
  payment: PaymentStatus
  fulfilment: FulfilmentStatus
  city: string
  address: string
  lines: OrderLine[]
  timeline: OrderEvent[]
}

const p = (i: number): Product => products[i % products.length]

function lines(...spec: [number, number][]): OrderLine[] {
  return spec.map(([idx, qty]) => {
    const prod = p(idx)
    return { productId: prod.id, name: prod.name, qty, price: prod.price }
  })
}

function sumLines(ls: OrderLine[]) {
  return ls.reduce((s, l) => s + l.price * l.qty, 0)
}

function timeline(reached: FulfilmentStatus): OrderEvent[] {
  const order: { key: FulfilmentStatus; label: string; at: string }[] = [
    { key: "processing", label: "ثبت و پرداخت سفارش", at: "۱۴۰۳/۰۳/۲۴ - ۱۰:۱۲" },
    { key: "packed", label: "آماده‌سازی و بسته‌بندی", at: "۱۴۰۳/۰۳/۲۴ - ۱۴:۴۰" },
    { key: "shipped", label: "تحویل به پست", at: "۱۴۰۳/۰۳/۲۵ - ۰۹:۰۵" },
    { key: "delivered", label: "تحویل به مشتری", at: "۱۴۰۳/۰۳/۲۶ - ۱۷:۳۰" },
  ]
  if (reached === "cancelled") {
    return [
      { ...order[0], done: true },
      { label: "لغو سفارش", at: "۱۴۰۳/۰۳/۲۴ - ۱۸:۰۰", done: true },
    ]
  }
  const reachedIdx = order.findIndex((s) => s.key === reached)
  return order.map((s, i) => ({ label: s.label, at: s.at, done: i <= reachedIdx }))
}

function order(
  o: Omit<AdminOrder, "subtotal" | "shipping" | "discount" | "total" | "itemsCount" | "timeline"> & {
    shipping?: number
    discount?: number
  }
): AdminOrder {
  const subtotal = sumLines(o.lines)
  const shipping = o.shipping ?? 0
  const discount = o.discount ?? 0
  return {
    ...o,
    subtotal,
    shipping,
    discount,
    total: subtotal + shipping - discount,
    itemsCount: o.lines.reduce((s, l) => s + l.qty, 0),
    timeline: timeline(o.fulfilment),
  }
}

export const adminOrders: AdminOrder[] = [
  order({
    id: "o-1042", number: 1042, customerId: "u1", customerName: "نیلوفر مرادی",
    customerEmail: "niloofar@example.com", date: "۱۴۰۳/۰۳/۲۴", payment: "paid",
    fulfilment: "processing", city: "تهران", address: "تهران، خیابان ولیعصر، کوچهٔ یاس، پلاک ۱۲، واحد ۳",
    lines: lines([0, 1]), shipping: 0,
  }),
  order({
    id: "o-1041", number: 1041, customerId: "u2", customerName: "آرش کریمی",
    customerEmail: "arash@example.com", date: "۱۴۰۳/۰۳/۲۴", payment: "paid",
    fulfilment: "shipped", city: "اصفهان", address: "اصفهان، خیابان چهارباغ، مجتمع نگین، طبقهٔ ۵",
    lines: lines([1, 1]), shipping: 350_000,
  }),
  order({
    id: "o-1040", number: 1040, customerId: "u5", customerName: "سارا احمدی",
    customerEmail: "sara@example.com", date: "۱۴۰۳/۰۳/۲۳", payment: "paid",
    fulfilment: "delivered", city: "شیراز", address: "شیراز، بلوار زند، کوچهٔ ۱۴، پلاک ۸",
    lines: lines([2, 1], [4, 1]), discount: 500_000,
  }),
  order({
    id: "o-1039", number: 1039, customerId: "u6", customerName: "بهنام رضایی",
    customerEmail: "behnam@example.com", date: "۱۴۰۳/۰۳/۲۳", payment: "refunded",
    fulfilment: "cancelled", city: "تبریز", address: "تبریز، خیابان آزادی، پلاک ۴۵",
    lines: lines([3, 1]),
  }),
  order({
    id: "o-1038", number: 1038, customerId: "u7", customerName: "مریم حسینی",
    customerEmail: "maryam@example.com", date: "۱۴۰۳/۰۳/۲۲", payment: "paid",
    fulfilment: "delivered", city: "تهران", address: "تهران، سعادت‌آباد، خیابان علامه، پلاک ۲۲",
    lines: lines([5, 2], [6, 1]), shipping: 0,
  }),
  order({
    id: "o-1037", number: 1037, customerId: "u8", customerName: "کیان عباسی",
    customerEmail: "kian@example.com", date: "۱۴۰۳/۰۳/۲۲", payment: "pending",
    fulfilment: "processing", city: "مشهد", address: "مشهد، بلوار وکیل‌آباد، پلاک ۹۰",
    lines: lines([7, 1]), shipping: 350_000,
  }),
  order({
    id: "o-1036", number: 1036, customerId: "u1", customerName: "نیلوفر مرادی",
    customerEmail: "niloofar@example.com", date: "۱۴۰۳/۰۳/۲۱", payment: "paid",
    fulfilment: "packed", city: "تهران", address: "تهران، خیابان ولیعصر، کوچهٔ یاس، پلاک ۱۲، واحد ۳",
    lines: lines([0, 1], [2, 1]),
  }),
  order({
    id: "o-1035", number: 1035, customerId: "u2", customerName: "آرش کریمی",
    customerEmail: "arash@example.com", date: "۱۴۰۳/۰۳/۲۰", payment: "failed",
    fulfilment: "cancelled", city: "اصفهان", address: "اصفهان، خیابان چهارباغ، مجتمع نگین، طبقهٔ ۵",
    lines: lines([4, 1]),
  }),
  order({
    id: "o-1034", number: 1034, customerId: "u9", customerName: "رضا نوری",
    customerEmail: "reza@example.com", date: "۱۴۰۳/۰۳/۲۰", payment: "paid",
    fulfilment: "delivered", city: "کرج", address: "کرج، عظیمیه، میدان استاندارد، پلاک ۷",
    lines: lines([6, 3]), shipping: 0,
  }),
  order({
    id: "o-1033", number: 1033, customerId: "u5", customerName: "سارا احمدی",
    customerEmail: "sara@example.com", date: "۱۴۰۳/۰۳/۱۹", payment: "paid",
    fulfilment: "shipped", city: "شیراز", address: "شیراز، بلوار زند، کوچهٔ ۱۴، پلاک ۸",
    lines: lines([1, 1], [5, 1]),
  }),
]

export function getOrder(id: string) {
  return adminOrders.find((o) => o.id === id || String(o.number) === id)
}

/* -------------------------------------------------------------------------- */
/*  Customers                                                                  */
/* -------------------------------------------------------------------------- */

export type AdminCustomer = {
  id: string
  name: string
  email: string
  phone: string
  ordersCount: number
  ltv: number
  joined: string
  lastSeen: string
  status: CustomerStatus
  tier: LoyaltyTier
  walletBalance: number
  city: string
}

export const adminCustomers: AdminCustomer[] = [
  { id: "u1", name: "نیلوفر مرادی", email: "niloofar@example.com", phone: "۰۹۱۲۱۲۳۴۵۶۷", ordersCount: 12, ltv: 142_000_000, joined: "۱۴۰۱/۰۸/۱۲", lastSeen: "امروز", status: "active", tier: "platinum", walletBalance: 4_200_000, city: "تهران" },
  { id: "u2", name: "آرش کریمی", email: "arash@example.com", phone: "۰۹۱۲۲۲۲۳۳۴۴", ordersCount: 5, ltv: 38_400_000, joined: "۱۴۰۲/۰۲/۰۳", lastSeen: "۲ روز پیش", status: "active", tier: "gold", walletBalance: 0, city: "اصفهان" },
  { id: "u5", name: "سارا احمدی", email: "sara@example.com", phone: "۰۹۳۳۴۴۴۵۵۶۶", ordersCount: 8, ltv: 96_300_000, joined: "۱۴۰۱/۱۱/۲۵", lastSeen: "دیروز", status: "active", tier: "gold", walletBalance: 1_250_000, city: "شیراز" },
  { id: "u6", name: "بهنام رضایی", email: "behnam@example.com", phone: "۰۹۰۲۱۱۱۲۲۳۳", ordersCount: 2, ltv: 9_600_000, joined: "۱۴۰۳/۰۱/۱۰", lastSeen: "۱ هفته پیش", status: "banned", tier: "bronze", walletBalance: 0, city: "تبریز" },
  { id: "u7", name: "مریم حسینی", email: "maryam@example.com", phone: "۰۹۱۹۸۷۶۵۴۳۲", ordersCount: 19, ltv: 211_500_000, joined: "۱۴۰۰/۰۵/۱۸", lastSeen: "امروز", status: "active", tier: "platinum", walletBalance: 7_800_000, city: "تهران" },
  { id: "u8", name: "کیان عباسی", email: "kian@example.com", phone: "۰۹۳۵۵۵۵۶۶۷۷", ordersCount: 3, ltv: 22_100_000, joined: "۱۴۰۲/۰۹/۰۲", lastSeen: "۳ روز پیش", status: "active", tier: "silver", walletBalance: 500_000, city: "مشهد" },
  { id: "u9", name: "رضا نوری", email: "reza@example.com", phone: "۰۹۱۲۳۳۳۴۴۵۵", ordersCount: 6, ltv: 51_700_000, joined: "۱۴۰۲/۰۴/۲۲", lastSeen: "دیروز", status: "active", tier: "gold", walletBalance: 0, city: "کرج" },
  { id: "u10", name: "الهام صادقی", email: "elham@example.com", phone: "۰۹۱۰۱۲۳۴۵۶۷", ordersCount: 1, ltv: 4_800_000, joined: "۱۴۰۳/۰۳/۰۱", lastSeen: "۵ روز پیش", status: "active", tier: "bronze", walletBalance: 0, city: "تهران" },
]

export const TIER_LABELS: Record<LoyaltyTier, string> = {
  bronze: "برنزی",
  silver: "نقره‌ای",
  gold: "طلایی",
  platinum: "پلاتینی",
}

export function getCustomer(id: string) {
  return adminCustomers.find((c) => c.id === id)
}

export function ordersForCustomer(customerId: string) {
  return adminOrders.filter((o) => o.customerId === customerId)
}

/* -------------------------------------------------------------------------- */
/*  Inventory                                                                  */
/* -------------------------------------------------------------------------- */

export type InventoryRow = {
  product: Product
  sku: string
  onHand: number
  reserved: number
  threshold: number
  available: number
  status: StockStatus
}

const ON_HAND = [42, 8, 0, 120, 5, 64, 17, 3]
const RESERVED = [4, 2, 0, 11, 1, 6, 2, 0]

export const inventory: InventoryRow[] = products.map((product, i) => {
  const onHand = ON_HAND[i] ?? 20
  const reserved = RESERVED[i] ?? 2
  const available = Math.max(0, onHand - reserved)
  const threshold = 10
  const status: StockStatus =
    available === 0 ? "out" : available <= threshold ? "low" : "in_stock"
  return {
    product,
    sku: `RMR-${product.category.slice(0, 2).toUpperCase()}-${product.id.padStart(3, "0")}`,
    onHand,
    reserved,
    threshold,
    available,
    status,
  }
})

export const inventorySummary = {
  skuCount: inventory.length,
  outOfStock: inventory.filter((r) => r.status === "out").length,
  lowStock: inventory.filter((r) => r.status === "low").length,
  stockValue: inventory.reduce((s, r) => s + r.onHand * r.product.price, 0),
}

/* -------------------------------------------------------------------------- */
/*  Reviews                                                                    */
/* -------------------------------------------------------------------------- */

export type AdminReview = {
  id: string
  productId: string
  productName: string
  reviewer: string
  rating: number
  title: string
  body: string
  date: string
  status: ReviewStatus
}

export const adminReviews: AdminReview[] = [
  { id: "r1", productId: "1", productName: p(0).name, reviewer: "نیلوفر مرادی", rating: 5, title: "بی‌نظیر بود", body: "عطر و طعمی فراتر از انتظار. بسته‌بندی هم بسیار شکیل و امن بود. حتماً دوباره خرید می‌کنم.", date: "۱۴۰۳/۰۳/۲۴", status: "pending" },
  { id: "r2", productId: "2", productName: p(1).name, reviewer: "آرش کریمی", rating: 4, title: "خوب اما گران", body: "کیفیت عالی بود ولی قیمتش کمی بالاست. ارسال سریع انجام شد.", date: "۱۴۰۳/۰۳/۲۳", status: "pending" },
  { id: "r3", productId: "3", productName: p(2).name, reviewer: "کاربر ناشناس", rating: 1, title: "تبلیغ", body: "این متن حاوی لینک تبلیغاتی و اسپم است و باید رد شود.", date: "۱۴۰۳/۰۳/۲۳", status: "pending" },
  { id: "r4", productId: "5", productName: p(4).name, reviewer: "سارا احمدی", rating: 5, title: "همیشگی سبد من", body: "برای چندمین بار سفارش دادم. کیفیت ثابت و عالی.", date: "۱۴۰۳/۰۳/۲۲", status: "approved" },
  { id: "r5", productId: "6", productName: p(5).name, reviewer: "رضا نوری", rating: 3, title: "متوسط", body: "انتظار بیشتری داشتم، ولی بد نبود.", date: "۱۴۰۳/۰۳/۲۱", status: "approved" },
  { id: "r6", productId: "4", productName: p(3).name, reviewer: "بهنام رضایی", rating: 2, title: "ناراضی", body: "با توضیحات سایت هم‌خوانی کامل نداشت.", date: "۱۴۰۳/۰۳/۲۰", status: "rejected" },
]

/* -------------------------------------------------------------------------- */
/*  Recipes (editorial)                                                        */
/* -------------------------------------------------------------------------- */

export type AdminRecipe = {
  id: string
  title: string
  slug: string
  status: RecipeStatus
  author: string
  updated: string
  hue: [string, string]
  pairedCategory: Category
}

export const adminRecipes: AdminRecipe[] = [
  { id: "rc1", title: "اولد فشن کلاسیک", slug: "old-fashioned", status: "published", author: "تیم محتوا", updated: "۱۴۰۳/۰۳/۲۰", hue: p(0).hue, pairedCategory: "Whisky" },
  { id: "rc2", title: "نگرونی متعادل", slug: "negroni", status: "published", author: "تیم محتوا", updated: "۱۴۰۳/۰۳/۱۵", hue: p(3).hue, pairedCategory: "Gin" },
  { id: "rc3", title: "مارگاریتا تازه", slug: "margarita", status: "draft", author: "سارا احمدی", updated: "۱۴۰۳/۰۳/۱۲", hue: p(5).hue, pairedCategory: "Tequila" },
  { id: "rc4", title: "موخیتو نعنا", slug: "mojito", status: "published", author: "تیم محتوا", updated: "۱۴۰۳/۰۳/۰۸", hue: p(4).hue, pairedCategory: "Rum" },
  { id: "rc5", title: "اسپریتز شامپاینی", slug: "champagne-spritz", status: "draft", author: "تیم محتوا", updated: "۱۴۰۳/۰۳/۰۲", hue: p(1).hue, pairedCategory: "Champagne" },
]

/* -------------------------------------------------------------------------- */
/*  Analytics & dashboard                                                      */
/* -------------------------------------------------------------------------- */

/** 30-day revenue/orders series (Jalali day labels), deterministic. */
export const revenueSeries: { day: string; revenue: number; orders: number }[] = [
  { day: "۱", revenue: 32_400_000, orders: 21 },
  { day: "۳", revenue: 28_900_000, orders: 18 },
  { day: "۵", revenue: 41_200_000, orders: 27 },
  { day: "۷", revenue: 38_600_000, orders: 24 },
  { day: "۹", revenue: 46_800_000, orders: 31 },
  { day: "۱۱", revenue: 52_300_000, orders: 34 },
  { day: "۱۳", revenue: 44_700_000, orders: 29 },
  { day: "۱۵", revenue: 58_100_000, orders: 38 },
  { day: "۱۷", revenue: 49_900_000, orders: 33 },
  { day: "۱۹", revenue: 61_400_000, orders: 41 },
  { day: "۲۱", revenue: 55_200_000, orders: 36 },
  { day: "۲۳", revenue: 67_800_000, orders: 44 },
  { day: "۲۵", revenue: 72_100_000, orders: 48 },
  { day: "۲۷", revenue: 64_500_000, orders: 42 },
  { day: "۲۹", revenue: 78_300_000, orders: 51 },
]

export const categoryShare: { category: Category; label: string; value: number }[] = [
  { category: "Whisky", label: "ویسکی", value: 34 },
  { category: "Wine", label: "شراب", value: 24 },
  { category: "Champagne", label: "شامپاین", value: 15 },
  { category: "Gin", label: "جین", value: 11 },
  { category: "Rum", label: "رام", value: 8 },
  { category: "Tequila", label: "تکیلا", value: 5 },
  { category: "Vodka", label: "ودکا", value: 3 },
]

export const ordersByStatus: { label: string; value: number; key: FulfilmentStatus }[] = [
  { label: "در حال پردازش", value: 18, key: "processing" },
  { label: "بسته‌بندی", value: 9, key: "packed" },
  { label: "ارسال‌شده", value: 23, key: "shipped" },
  { label: "تحویل‌شده", value: 64, key: "delivered" },
  { label: "لغوشده", value: 6, key: "cancelled" },
]

export const topProducts = products
  .map((product, i) => ({
    product,
    units: [142, 118, 96, 87, 73, 61, 54, 48][i] ?? 30,
    revenue: ([142, 118, 96, 87, 73, 61, 54, 48][i] ?? 30) * product.price,
  }))
  .sort((a, b) => b.revenue - a.revenue)
  .slice(0, 6)

export const funnel: { stage: string; value: number }[] = [
  { stage: "بازدید", value: 24800 },
  { stage: "مشاهدهٔ محصول", value: 11200 },
  { stage: "افزودن به سبد", value: 4300 },
  { stage: "شروع پرداخت", value: 1800 },
  { stage: "خرید موفق", value: 948 },
]

export const newVsReturning: { label: string; value: number }[] = [
  { label: "مشتری جدید", value: 38 },
  { label: "بازگشتی", value: 62 },
]

export const dashboardSummary = {
  revenueToday: 48_600_000,
  revenueTodayTrend: "+۱۲٪",
  ordersToday: 37,
  ordersTodayTrend: "+۸٪",
  newCustomers: 14,
  newCustomersTrend: "−۳٪",
  avgOrderValue: 6_400_000,
  avgOrderValueTrend: "+۵٪",
  revenue30d: 1_284_000_000,
  revenue30dTrend: "+۱۸٪",
  orders30d: 948,
  orders30dTrend: "+۹٪",
  activeCustomers: 412,
  activeCustomersTrend: "+۴٪",
  conversionRate: "٪۳٫۲",
  conversionTrend: "−۱٪",
}

/** Recent orders for the dashboard mini-table. */
export const recentOrders = adminOrders.slice(0, 5)

/** Low-stock rows for the dashboard alert. */
export const lowStock = inventory
  .filter((r) => r.status !== "in_stock")
  .sort((a, b) => a.available - b.available)
