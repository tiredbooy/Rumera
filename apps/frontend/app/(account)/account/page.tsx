import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";

import { getSession } from "@/lib/auth/session";
import { AccountPageHeader } from "@/features/account/account/components/account-page-header";
import { AccountOverview } from "@/features/account/account/components/account-overview";
import { prefetchAccountOverview } from "@/features/account/account/components/prefetch-account-overview";

export default async function AccountOverviewPage() {
  const session = await getSession();
  const firstName = session?.user?.name?.split(" ")[0] ?? "دوست عزیز";

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: false,
      },
    },
  });
  await prefetchAccountOverview(queryClient);

  return (
    <>
      <AccountPageHeader
        eyebrow="خوش آمدید"
        title={`سلام، ${firstName}`}
        description="خلاصه‌ای از حساب، سفارش‌ها و کیف پول شما."
      />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <AccountOverview />
      </HydrationBoundary>
    </>
  );
}
