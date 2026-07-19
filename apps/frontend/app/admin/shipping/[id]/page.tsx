import { notFound } from "next/navigation";

import { requireShippingAdmin } from "@/features/admin/shipping/admin-only";
import { ShippingZoneEditView } from "@/features/admin/shipping/components/shipping-editor-views";

export default async function AdminEditShippingZonePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawID } = await params;
  if (!/^[1-9]\d*$/.test(rawID)) notFound();
  const id = Number(rawID);
  if (!Number.isSafeInteger(id)) notFound();
  await requireShippingAdmin(`/admin/shipping/${id}`);
  return <ShippingZoneEditView id={id} />;
}
