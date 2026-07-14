import { HomeView } from "@/features/home/components/home-view";

// Home is ISR — the hero slides are admin-managed and refetched periodically.
export const revalidate = 300;

export default function Home() {
  return <HomeView />;
}
