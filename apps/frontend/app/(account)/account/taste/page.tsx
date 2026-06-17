import { AccountPageHeader } from "@/components/account/account-page-header"
import { TasteQuiz } from "@/components/taste/taste-quiz"

export default function AccountTastePage() {
  return (
    <>
      <AccountPageHeader
        eyebrow="شخصی‌سازی"
        title="سلیقهٔ من"
        description="ترجیحات خود را بگویید تا پیشنهادها برایتان شخصی‌سازی شوند."
      />
      <div className="max-w-2xl">
        <TasteQuiz />
      </div>
    </>
  )
}
