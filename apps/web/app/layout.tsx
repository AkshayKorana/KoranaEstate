import type { Metadata } from 'next'
import './globals.css'
import Navbar from './components/Navbar'
import Providers from './providers'

export const metadata: Metadata = {
  title: {
    default: 'Korana Estate — Coffee & Spice Marketplace',
    template: '%s | Korana Estate',
  },
  description: 'Live coffee prices from Coffee Board India. Buy, sell and discover premium Arabica & Robusta from Karnataka estates. Raw marketplace, estate essentials, and real-time commodity intelligence.',
  keywords: ['coffee prices', 'arabica', 'robusta', 'Karnataka coffee', 'Coffee Board India', 'coffee marketplace', 'spice marketplace', 'Korana Estate'],
  openGraph: {
    title: 'Korana Estate — Coffee & Spice Marketplace',
    description: 'Live coffee prices, raw commodity marketplace and estate essentials from Karnataka.',
    type: 'website',
  },
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
