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
import { actionConfirmDescription } from "./subscription-display-helpers";

export type PendingSubscriptionAction = {
  id: number;
  action: Extract<SubscriptionAction, "pause" | "skip" | "cancel">;
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
  const copy = target ? actionConfirmDescription(target.action) : null;

  return (
    <AlertDialog open={target !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>{copy?.title ?? "تأیید"}</AlertDialogTitle>
          <AlertDialogDescription className="leading-relaxed">
            {copy?.body}
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
            {copy?.confirm ?? "تأیید"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
