import { notFound } from "next/navigation";

import { CouponEditView } from "@/features/admin/coupons/components/coupon-editor-view";
import { requireCouponAdmin } from "@/features/admin/coupons/admin-only";

export default async function AdminEditCouponPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawID } = await params;
  if (!/^[1-9]\d*$/.test(rawID)) notFound();
  const id = Number(rawID);
  if (!Number.isSafeInteger(id)) notFound();
  await requireCouponAdmin(`/admin/coupons/${id}`);
  return <CouponEditView id={id} />;
}
