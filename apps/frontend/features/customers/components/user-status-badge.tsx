import { Ban, CheckCircle2 } from "lucide-react";

import { Badge, type BadgeSemantic } from "@/components/ui/badge";

export function UserStatusBadge({
  active,
  banned = false,
}: {
  active: boolean;
  banned?: boolean;
}) {
  const available = active && !banned;
  const Icon = available ? CheckCircle2 : Ban;
  // Banned is punitive (destructive); merely inactive is not a failure.
  const semantic: BadgeSemantic = available
    ? { tone: "success" }
    : banned
      ? { variant: "destructive" }
      : { tone: "neutral" };

  return (
    <Badge {...semantic} className="gap-1.5 rounded-full">
      <Icon aria-hidden />
      {banned ? "مسدود" : active ? "فعال" : "غیرفعال"}
    </Badge>
  );
}
