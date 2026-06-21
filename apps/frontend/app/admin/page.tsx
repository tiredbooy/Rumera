import { PageHeader } from "@/components/dashboard/page-header"
import { DashboardBoard } from "@/components/admin/dashboard-board"

export default function AdminDashboard() {
  return (
    <>
      <PageHeader title="داشبورد" description="نمای کلی عملکرد فروشگاه در یک نگاه." />
      <DashboardBoard />
    </>
  )
}
