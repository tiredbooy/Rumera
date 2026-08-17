import { Eye, EyeOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function ProductStatusBadge({ active }: { active: boolean }) {
  const Icon = active ? Eye : EyeOff;

  return (
    <Badge tone={active ? "success" : "warning"} className="gap-1.5 rounded-full">
      <Icon className="size-3.5" aria-hidden />
      {active ? "منتشرشده" : "پیش‌نویس"}
    </Badge>
  );
}
