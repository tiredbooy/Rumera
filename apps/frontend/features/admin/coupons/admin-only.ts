import "server-only";

import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/session";

export async function requireCouponAdmin(callbackUrl = "/admin/coupons") {
  const session = await requireStaff(callbackUrl);
  if (session.role !== "admin") redirect("/forbidden");
  return session;
}
