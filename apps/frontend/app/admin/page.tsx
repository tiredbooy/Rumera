import { PageHeader } from "@/features/dashboard/components/page-header";
import { DashboardBoard } from "@/features/admin/stats/components/dashboard-board";

export default function AdminDashboard() {
  return (
    <>
      <PageHeader
        title="داشبورد"
        description="نمای کلی عملکرد فروشگاه در یک نگاه."
      />
      <DashboardBoard />
    </>
  );
}
