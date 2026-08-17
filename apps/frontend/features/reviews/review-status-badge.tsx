import { Badge, type BadgeSemantic } from "@/components/ui/badge";

import { REVIEW_STATUS_FA } from "./labels";
import type { ReviewStatus } from "./types";

const STATUS: Record<ReviewStatus, BadgeSemantic> = {
  pending: { tone: "warning" },
  approved: { tone: "success" },
  rejected: { variant: "destructive" },
};

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  return (
    <Badge {...STATUS[status]} className="gap-1.5 rounded-full">
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {REVIEW_STATUS_FA[status]}
    </Badge>
  );
}
