/**
 * Backend endpoint paths (relative to `/api/v1`), centralised so route strings
 * live in one place. Mirrors `apps/backend/docs/api/*`.
 */
export const endpoints = {
  auth: {
    login: "/auth/login",
    register: "/auth/register",
    refresh: "/auth/refresh",
    logout: "/auth/logout",
    me: "/auth/me",
    forgotPassword: "/auth/password/forgot",
    validateReset: "/auth/password/validate",
    resetPassword: "/auth/password/reset",
  },
  products: {
    list: "/products",
    detail: (slug: string) => `/products/${slug}`,
  },
  categories: { list: "/categories" },
  brands: { list: "/brands" },
  orders: {
    list: "/orders",
    detail: (id: string) => `/orders/${id}`,
  },
  addresses: "/addresses",
  wishlist: "/wishlist",
  wallet: "/wallet",
  reviews: "/reviews",
  cart: "/cart",
  recipes: {
    list: "/recipes",
    detail: (slug: string) => `/recipes/${slug}`,
  },
  recommendations: "/recommendations",
  inventory: "/inventory",
  analytics: "/analytics",
  admin: {
    users: "/admin/users",
    user: (id: string) => `/admin/users/${id}`,
    products: "/admin/products",
    orders: "/admin/orders",
  },
} as const
