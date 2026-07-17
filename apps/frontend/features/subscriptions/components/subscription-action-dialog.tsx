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
import type { SubscriptionAction } from "@/features/subscriptions/types";
import { cn } from "@/lib/utils";

export type PendingSubscriptionAction = {
  id: number;
  action: Extract<SubscriptionAction, "pause" | "cancel">;
} | null;

type SubscriptionActionDialogProps = {
  target: PendingSubscriptionAction;
  onOpenChange: (open: boolean) => void;
  onConfirm: (target: NonNullable<PendingSubscriptionAction>) => void;
};

export function SubscriptionActionDialog({
  target,
  onOpenChange,
  onConfirm,
}: SubscriptionActionDialogProps) {
  return (
    <AlertDialog open={target !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {target?.action === "cancel" ? "لغو اشتراک" : "توقف اشتراک"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {target?.action === "cancel"
              ? "با لغو اشتراک، دیگر هیچ باکسی برایتان ارسال نمی‌شود. هر زمان بخواهید می‌توانید آن را دوباره فعال کنید."
              : "با توقف اشتراک، ارسال‌ها موقتاً متوقف می‌شوند و در این مدت باکسی فرستاده نمی‌شود. هر زمان آماده بودید می‌توانید آن را از سر بگیرید."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer">
            انصراف
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              "cursor-pointer",
              target?.action === "cancel" &&
                "bg-destructive text-white hover:bg-destructive/90",
            )}
            onClick={() => {
              if (!target) return;
              onConfirm(target);
            }}
          >
            {target?.action === "cancel" ? "بله، لغو شود" : "بله، متوقف شود"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
