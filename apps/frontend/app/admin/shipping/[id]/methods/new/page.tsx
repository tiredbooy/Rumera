import { notFound } from "next/navigation";

import { requireShippingAdmin } from "@/features/admin/shipping/admin-only";
import { ShippingMethodCreateView } from "@/features/admin/shipping/components/shipping-editor-views";

export default async function AdminNewShippingMethodPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawZoneID } = await params;
  if (!/^[1-9]\d*$/.test(rawZoneID)) notFound();
  const zoneID = Number(rawZoneID);
  if (!Number.isSafeInteger(zoneID)) notFound();
  await requireShippingAdmin(`/admin/shipping/${zoneID}/methods/new`);
  return <ShippingMethodCreateView zoneID={zoneID} />;
}
