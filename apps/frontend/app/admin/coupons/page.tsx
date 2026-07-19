import { CouponsBoard } from "@/features/admin/coupons/components/coupons-board";
import { requireCouponAdmin } from "@/features/admin/coupons/admin-only";

export default async function AdminCouponsPage() {
  await requireCouponAdmin();
  return <CouponsBoard />;
}
