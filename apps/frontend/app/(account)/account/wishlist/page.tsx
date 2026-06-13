import { PageHeader } from "@/components/dashboard/page-header"
import { ProductCard } from "@/components/product-card"
import { products } from "@/lib/products"

// Sample selection until /api/v1/wishlist is wired — reuses the storefront card.
const sample = products.slice(0, 3)

export default function AccountWishlistPage() {
  return (
    <>
      <PageHeader
        title="علاقه‌مندی‌ها"
        description="بطری‌هایی که برای بعد ذخیره کرده‌اید (نمونه — در انتظار اتصال به سرویس)."
      />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {sample.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </>
  )
}
