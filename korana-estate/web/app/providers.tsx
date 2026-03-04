'use client'

import { SessionProvider } from 'next-auth/react'
import { LanguageProvider } from './language-context'
import { ThemeProvider } from './theme-context'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <LanguageProvider>{children}</LanguageProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}
