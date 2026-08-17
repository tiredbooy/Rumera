import { notFound } from "next/navigation";

import { OptionTypeForm } from "@/features/admin/options/components/option-type-form";
import {
  getOptionType,
  listOptionValues,
} from "@/features/admin/options/server";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { ApiError } from "@/lib/api/client";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function AdminOptionEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission(PERMISSIONS.PRODUCTS_READ);
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();

  let option;
  try {
    const type = await getOptionType(id);
    const values = await listOptionValues(id);
    option = { ...type, values };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <>
      <PageHeader
        title={option.display_name}
        description={`کد ${option.title} · مقادیر قابل استفاده مجدد در همهٔ محصولات`}
      />
      <OptionTypeForm
        mode="edit"
        option={option}
        canWrite={can(session, PERMISSIONS.PRODUCTS_WRITE)}
      />
    </>
  );
}
