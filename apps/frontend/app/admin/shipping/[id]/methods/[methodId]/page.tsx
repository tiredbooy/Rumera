import { notFound } from "next/navigation";

import { requireShippingAdmin } from "@/features/admin/shipping/admin-only";
import { ShippingMethodEditView } from "@/features/admin/shipping/components/shipping-editor-views";

export default async function AdminEditShippingMethodPage({
  params,
}: {
  params: Promise<{ id: string; methodId: string }>;
}) {
  const { id: rawZoneID, methodId: rawMethodID } = await params;
  if (!/^[1-9]\d*$/.test(rawZoneID) || !/^[1-9]\d*$/.test(rawMethodID)) {
    notFound();
  }
  const zoneID = Number(rawZoneID);
  const methodID = Number(rawMethodID);
  if (!Number.isSafeInteger(zoneID) || !Number.isSafeInteger(methodID)) {
    notFound();
  }
  await requireShippingAdmin(`/admin/shipping/${zoneID}/methods/${methodID}`);
  return <ShippingMethodEditView zoneID={zoneID} methodID={methodID} />;
}
