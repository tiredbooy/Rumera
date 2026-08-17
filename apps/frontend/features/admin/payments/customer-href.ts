const PUBLIC_USER_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `/admin/customers/:id` only when `user_id` is the public UUID. */
export function adminCustomerHref(
  userId: string | number | undefined,
): string | undefined {
  if (typeof userId !== "string") return undefined;
  const id = userId.trim();
  if (!PUBLIC_USER_ID.test(id)) return undefined;
  return `/admin/customers/${id}`;
}
