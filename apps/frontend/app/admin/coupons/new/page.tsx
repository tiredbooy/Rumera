import { CouponCreateView } from "@/features/admin/coupons/components/coupon-editor-view";
import { requireCouponAdmin } from "@/features/admin/coupons/admin-only";

export default async function AdminNewCouponPage() {
  await requireCouponAdmin("/admin/coupons/new");
  return <CouponCreateView />;
}
