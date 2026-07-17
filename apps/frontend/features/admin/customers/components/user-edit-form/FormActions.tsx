import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function FormActions({
  isSubmitting,
  isDirty,
  onCancel,
}: {
  isSubmitting: boolean;
  isDirty: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Button type="submit" size="lg" disabled={isSubmitting || !isDirty}>
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : null}
        ذخیرهٔ تغییرات
      </Button>
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={isSubmitting}
        onClick={onCancel}
      >
        انصراف
      </Button>
    </div>
  );
}
