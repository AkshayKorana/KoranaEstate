import type { Metadata } from 'next'
import './globals.css'
import Navbar from './components/Navbar'
import Providers from './providers'

export const metadata: Metadata = {
  title: 'Korana Estate Marketplace',
  description: 'Coffee marketplace with commodity dashboard and auth',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>
          <Navbar />
          <div className="content-under-navbar">{children}</div>
        </Providers>
      </body>
    </html>
  )
}
