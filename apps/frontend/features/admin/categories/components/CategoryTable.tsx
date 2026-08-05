"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Plus,
  FolderTree,
  CornerDownLeft,
  AlertCircle,
  RotateCw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { faNum } from "@/lib/products";
import { DashboardErrorState } from "@/features/dashboard/components/async-state";
import {
  CategoryApiError,
  getCategoryTree,
  deleteCategory,
} from "@/features/admin/categories/client";
import type { CategoryTree } from "@/features/catalog/categories/types";
import { CATEGORIES_QUERY_KEY } from "@/lib/admin/category-keys";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** One flattened tree node carrying its depth and child count for the table. */
type FlatRow = {
  node: CategoryTree;
  depth: number;
  childCount: number;
};

function flatten(
  nodes: CategoryTree[],
  depth = 0,
  out: FlatRow[] = [],
): FlatRow[] {
  for (const node of nodes) {
    const childCount = node.children?.length ?? 0;
    out.push({ node, depth, childCount });
    if (childCount) flatten(node.children!, depth + 1, out);
  }
  return out;
}

function countTree(nodes: CategoryTree[]): number {
  return nodes.reduce((n, node) => n + 1 + countTree(node.children ?? []), 0);
}

export function CategoriesTable({ canWrite }: { canWrite: boolean }) {
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] =
    React.useState<CategoryTree | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<
    CategoryTree[]
  >({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: getCategoryTree,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: async () => {
      toast.success("دسته‌بندی حذف شد");
      setPendingDelete(null);
      await queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
    },
    onError: (e) => {
      if (e instanceof CategoryApiError && e.code === "HAS_CHILDREN") {
        toast.error(
          "این دسته‌بندی زیرمجموعه دارد و قابل حذف نیست. ابتدا زیرمجموعه‌ها را حذف یا جابه‌جا کنید.",
        );
      } else if (e instanceof CategoryApiError) {
        toast.error(e.message);
      } else {
        toast.error("حذف دسته‌بندی ناموفق بود");
      }
      setPendingDelete(null);
    },
  });

  const rows = React.useMemo(() => (data ? flatten(data) : []), [data]);
  const total = data ? countTree(data) : 0;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04]">
        <div className="flex flex-col divide-y divide-border/40">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4">
              <Skeleton className="h-4 w-44 rounded-md" />
              <Skeleton className="ms-auto h-4 w-20 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <DashboardErrorState
        title="بارگذاری دسته‌بندی‌ها ناموفق بود"
        description="ارتباط با سرور برقرار نشد. دوباره تلاش کنید."
        onRetry={() => void refetch()}
        isRetrying={isFetching}
      />
    );
  }

  // ── Empty ────────────────────────────────────────────────────────────────
  if (rows.length === 0) {
    return (
      <div className="border-hairline flex flex-col items-center justify-center gap-4 rounded-2xl bg-card px-6 py-16 text-center ring-1 ring-foreground/[0.04]">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 ring-1 ring-border/60">
          <FolderTree className="size-6 text-muted-foreground opacity-70" />
        </span>
        <div className="space-y-1">
          <p className="font-medium">هنوز دسته‌بندی‌ای ثبت نشده است</p>
          <p className="text-sm text-muted-foreground">
            اولین دستهٔ کاتالوگ را بسازید تا محصولات را سازمان‌دهی کنید.
          </p>
        </div>
        {canWrite ? (
          <Button size="sm" asChild>
            <Link href="/admin/categories/new">
              <Plus className="size-4" /> دسته‌بندی جدید
            </Link>
          </Button>
        ) : null}
      </div>
    );
  }

  // ── Table ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end px-1">
        <span className="rounded-md bg-muted/60 px-2 py-1 text-xs font-medium tabular-nums text-muted-foreground">
          {faNum(total)} دسته‌بندی
          {isFetching ? (
            <Loader2 className="ms-1.5 inline size-3 animate-spin align-[-1px]" />
          ) : null}
        </span>
      </div>

      <div className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.04]">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30">
              <TableHead className="h-10 text-start text-xs font-medium text-muted-foreground">
                نام دسته‌بندی
              </TableHead>
              <TableHead className="h-10 text-start text-xs font-medium text-muted-foreground">
                نامک
              </TableHead>
              <TableHead className="h-10 text-start text-xs font-medium text-muted-foreground">
                زیرمجموعه‌ها
              </TableHead>
              <TableHead className="h-10 w-12 text-end text-xs font-medium text-muted-foreground">
                <span className="sr-only">عملیات</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ node, depth, childCount }) => (
              <TableRow key={node.id} className="border-border/40">
                <TableCell>
                  <div
                    className="flex items-center gap-2"
                    style={{ paddingInlineStart: `${depth * 1.25}rem` }}
                  >
                    {depth > 0 ? (
                      <CornerDownLeft
                        className="size-3.5 shrink-0 -scale-x-100 text-muted-foreground/60"
                        aria-hidden
                      />
                    ) : (
                      <FolderTree
                        className="size-4 shrink-0 text-muted-foreground/70"
                        aria-hidden
                      />
                    )}
                    <span
                      className={
                        depth === 0 ? "font-medium" : "text-foreground/90"
                      }
                    >
                      {node.title}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {node.slug ? (
                    <code dir="ltr" className="text-xs text-muted-foreground">
                      {node.slug}
                    </code>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {childCount > 0 ? (
                    <span className="text-muted-foreground tabular-nums">
                      {faNum(childCount)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`عملیات دستهٔ ${node.title}`}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/admin/categories/${node.id}`}>
                          <Pencil className="size-4" /> ویرایش
                        </Link>
                      </DropdownMenuItem>
                      {canWrite ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setPendingDelete(node)}
                          >
                            <Trash2 className="size-4" /> حذف
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => {
          if (!o && !deleteMutation.isPending) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف دسته‌بندی</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف «{pendingDelete?.title}» مطمئن هستید؟ این عمل قابل
              بازگشت نیست.
              {pendingDelete?.children?.length
                ? " توجه: دسته‌بندی دارای زیرمجموعه قابل حذف نیست."
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              انصراف
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
              }}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              حذف دسته‌بندی
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
