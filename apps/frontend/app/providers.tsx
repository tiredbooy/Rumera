"use client"

import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SessionProvider } from "next-auth/react"
import { NuqsAdapter } from "nuqs/adapters/next/app"

import { ThemeProvider } from "@/components/theme-provider"
import { DirectionProvider } from "@/components/ui/direction"
import { SessionGuard } from "@/components/auth/session-guard"

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <SessionProvider>
      {/* Signs the user out only when silent token refresh fails for good. */}
      <SessionGuard />
      <QueryClientProvider client={queryClient}>
        <NuqsAdapter>
          <DirectionProvider dir="rtl">
            <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              enableSystem
              disableTransitionOnChange
            >
              {children}
            </ThemeProvider>
          </DirectionProvider>
        </NuqsAdapter>
      </QueryClientProvider>
    </SessionProvider>
  )
}
