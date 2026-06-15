import { PageHeader } from "@/components/dashboard/page-header"
import { TasteQuiz } from "@/components/taste/taste-quiz"

export default function AccountTastePage() {
  return (
    <>
      <PageHeader
        title="سلیقهٔ من"
        description="ترجیحات خود را بگویید تا پیشنهادها برایتان شخصی‌سازی شوند."
      />
      <div className="max-w-2xl">
        <TasteQuiz />
      </div>
    </>
  )
}
