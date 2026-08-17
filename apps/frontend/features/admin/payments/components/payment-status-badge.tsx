import { Badge, type BadgeSemantic } from "@/components/ui/badge";
import { PAYMENT_STATUS_FA } from "@/features/payments/presentation";
import type { PaymentStatus } from "@/features/payments/types";

const STATUS_VARIANTS: Record<PaymentStatus, BadgeSemantic> = {
  pending: { tone: "warning" },
  succeeded: { tone: "success" },
  failed: { variant: "destructive" },
  // Refunds are settled money moving back out — neutral, not success.
  refunded: { tone: "neutral" },
  partially_refunded: { tone: "neutral" },
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge {...STATUS_VARIANTS[status]}>{PAYMENT_STATUS_FA[status]}</Badge>
  );
}
