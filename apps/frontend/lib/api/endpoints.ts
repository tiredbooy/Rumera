/** Shared backend endpoint paths still consumed by server API modules. */
export const endpoints = {
  products: {
    list: "/products",
    detail: (slug: string) => `/products/${slug}`,
  },
  categories: { list: "/categories" },
  brands: { list: "/brands" },
  admin: {
    products: "/admin/products",
    categories: "/admin/categories",
    category: (id: string) => `/admin/categories/${id}`,
    brands: "/admin/brands",
    brand: (id: string) => `/admin/brands/${id}`,
  },
} as const
