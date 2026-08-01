import "server-only";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getAdminUser } from "@/features/customers/api";
import type { AdminUser } from "@/features/customers/types";
import { PageHeader } from "@/features/dashboard/components/page-header";
import { ApiError } from "@/lib/api/errors";

import { UserEditForm } from "./UserEditForm";

export async function CustomerEditView({
  targetUserId,
  currentUserId,
  currentUserEmail,
}: {
  targetUserId: string;
  currentUserId?: string;
  currentUserEmail?: string | null;
}) {
  let user: AdminUser;
  try {
    user = await getAdminUser(targetUserId);
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 400 || error.status === 404 || error.status === 422)
    ) {
      notFound();
    }
    throw error;
  }

  const backButton = (
    <Button variant="outline" size="sm" asChild>
      <Link href="/admin/customers">
        <ArrowRight className="size-4" /> بازگشت
      </Link>
    </Button>
  );

  const isSelf =
    (!!currentUserId && currentUserId === user.user_id) ||
    (!!currentUserEmail && currentUserEmail === user.email);
  const fullName = [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    <>
      <PageHeader
        eyebrow={
          <nav
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
            aria-label="مسیر"
          >
            <Link
              href="/admin/customers"
              className="transition-colors hover:text-foreground"
            >
              کاربران
            </Link>
            <span aria-hidden>/</span>
            <span className="text-foreground">{fullName || user.email}</span>
          </nav>
        }
        title="ویرایش کاربر"
        description={fullName || user.email}
        actions={backButton}
      />
      <UserEditForm user={user} isSelf={isSelf} />
    </>
  );
}
