import { RouteLoading } from "@/components/route-state";

export default function CategoriesLoading() {
  return (
    <RouteLoading
      label="در حال بارگذاری دسته‌بندی‌ها"
      className="min-h-[65vh]"
    />
  );
}
