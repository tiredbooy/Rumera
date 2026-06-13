import { MapPin, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/dashboard/page-header"
import { Placeholder } from "@/components/dashboard/placeholder"

export default function AccountAddressesPage() {
  return (
    <>
      <PageHeader
        title="آدرس‌ها"
        description="آدرس‌های تحویل خود را مدیریت کنید."
        actions={
          <Button size="sm">
            <Plus className="size-4" /> آدرس جدید
          </Button>
        }
      />
      <Placeholder
        icon={MapPin}
        title="هنوز آدرسی ثبت نشده"
        description="با اتصال به /api/v1/addresses آدرس‌های شما اینجا فهرست و قابل ویرایش می‌شوند."
      />
    </>
  )
}
