'use client'

import { SessionProvider } from 'next-auth/react'
import { LanguageProvider } from './language-context'
import { ThemeProvider } from './theme-context'
import InactivityGuard from './components/InactivityGuard'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus={true}>
      <ThemeProvider>
        <LanguageProvider>
          <InactivityGuard />
          {children}
        </LanguageProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}
