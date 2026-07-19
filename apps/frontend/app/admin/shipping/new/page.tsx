import { requireShippingAdmin } from "@/features/admin/shipping/admin-only";
import { ShippingZoneCreateView } from "@/features/admin/shipping/components/shipping-editor-views";

export default async function AdminNewShippingZonePage() {
  await requireShippingAdmin("/admin/shipping/new");
  return <ShippingZoneCreateView />;
}
