import { RouteLoading } from "@/components/route-state";

export default function AccountLoading() {
  return (
    <RouteLoading
      label="در حال بارگذاری حساب کاربری"
      variant="dashboard"
      className="max-w-none px-0 py-0"
    />
  );
}
