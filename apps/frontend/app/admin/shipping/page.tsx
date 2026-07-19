import { requireShippingAdmin } from "@/features/admin/shipping/admin-only";
import { ShippingZonesBoard } from "@/features/admin/shipping/components/shipping-zones-board";

export default async function AdminShippingPage() {
  await requireShippingAdmin();
  return <ShippingZonesBoard />;
}
