"use client"

import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SessionProvider } from "next-auth/react"

import { ThemeProvider } from "@/components/theme-provider"
import { DirectionProvider } from "@/components/ui/direction"

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
      <QueryClientProvider client={queryClient}>
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
      </QueryClientProvider>
    </SessionProvider>
  )
}
