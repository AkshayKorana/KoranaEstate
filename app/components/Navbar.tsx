'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'

function Icon({ label }: { label: string }) {
  return <span aria-hidden="true" className="text-sm font-semibold leading-none">{label}</span>
}

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'About' },
]

export default function Navbar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const isActivePath = (path: string) => pathname === path

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled || isMobileMenuOpen
          ? 'bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4 md:py-6">
          <Link href="/" className="flex items-center space-x-2 text-primary">
            <Icon label="CO" />
            <span className="text-xl font-semibold">Korana Estate</span>
          </Link>

          <nav className="hidden md:flex items-center space-x-8">
            {navItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`transition-all duration-300 font-medium hover:text-coffee-600 ${
                  isActivePath(item.href) ? 'text-coffee-600' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center space-x-4">
            {status === 'authenticated' && session?.user ? (
              <>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {session.user.name || session.user.email}
                </span>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                href="/auth"
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>

          <button
            className="md:hidden p-2 rounded-md focus:outline-none"
            onClick={() => setIsMobileMenuOpen(v => !v)}
            aria-label="Toggle menu"
          >
            <Icon label={isMobileMenuOpen ? 'X' : '≡'} />
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-gray-900 shadow-lg">
          <div className="px-4 pt-2 pb-6 space-y-4">
            {navItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  isActivePath(item.href)
                    ? 'bg-coffee-50 dark:bg-coffee-900/30 text-coffee-600 dark:text-coffee-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-4 pb-2 border-t border-gray-200 dark:border-gray-700">
              <Link href="/profile" className="flex items-center px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800" onClick={() => setIsMobileMenuOpen(false)}>Profile</Link>
              <Link href="/messages" className={`flex items-center px-3 py-2 rounded-md text-base font-medium ${isActivePath('/messages') ? 'bg-coffee-50 dark:bg-coffee-900/30 text-coffee-600 dark:text-coffee-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`} onClick={() => setIsMobileMenuOpen(false)}>Messages</Link>
              <Link href="/favorites" className="flex items-center px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800" onClick={() => setIsMobileMenuOpen(false)}>Favorites</Link>
            </div>
            <div className="pt-2">
              {status === 'authenticated' ? (
                <button
                  type="button"
                  className="block w-full rounded-md border border-gray-300 px-4 py-2 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                  onClick={async () => {
                    setIsMobileMenuOpen(false)
                    await signOut({ callbackUrl: '/' })
                  }}
                >
                  Sign Out
                </button>
              ) : (
                <Link
                  href="/auth"
                  className="block w-full rounded-md bg-emerald-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
