import { Badge } from "@/components/ui/badge";
import { PAYMENT_STATUS_FA } from "@/features/payments/presentation";
import type { PaymentStatus } from "@/features/payments/types";

const STATUS_VARIANTS: Record<
  PaymentStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  succeeded: "default",
  failed: "destructive",
  refunded: "secondary",
  partially_refunded: "secondary",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge variant={STATUS_VARIANTS[status]}>{PAYMENT_STATUS_FA[status]}</Badge>
  );
}
