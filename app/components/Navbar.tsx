'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'

function Icon({ label }: { label: string }) {
  return <span aria-hidden="true" className="text-2xl font-bold leading-none">{label}</span>
}

function CoffeeIcon({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className} aria-hidden="true">
      <path d="M3 8h12v5a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8Z" />
      <path d="M15 10h2a3 3 0 0 1 0 6h-2" />
      <path d="M7 3h2" />
      <path d="M11 3h2" />
    </svg>
  )
}

const navItems = [
  { href: '/', label: 'Home', icon: '🏠' },
  { href: '/raw-marketplace', label: 'Raw Marketplace', icon: '🌱' },
  { href: '/store', label: 'Store', icon: '🛒' },
  { href: '/messages', label: 'Messages', icon: '💬' },
]

export default function Navbar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const isActivePath = (path: string) => (path.startsWith('/#') ? pathname === '/' : pathname === path)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled || isMobileMenuOpen
          ? 'glass shadow-xl border-b border-emerald-100'
          : 'bg-white/60 backdrop-blur-sm'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4 md:py-5">
          {/* Logo - Click to go Home */}
          <Link href="/" className="flex items-center space-x-3 group cursor-pointer" title="Go to Home">
            <div className="p-2 rounded-xl gradient-emerald-coffee group-hover:scale-110 transition-transform duration-300 float-animation">
              <CoffeeIcon className="h-7 w-7 text-white" />
            </div>
            <div>
              <span className="text-2xl font-bold bg-gradient-to-r from-emerald-600 via-emerald-700 to-amber-800 bg-clip-text text-transparent">
                Korana Estate
              </span>
              <p className="text-xs text-gray-600 -mt-1">Coffee & Spices</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-2 bg-white/50 backdrop-blur-sm rounded-2xl px-2 py-2 shadow-lg">
            {navItems.map(item => {
              const isActive = isActivePath(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    relative px-6 py-2.5 rounded-xl font-semibold text-sm
                    transition-all duration-300 flex items-center space-x-2
                    ${isActive 
                      ? 'gradient-emerald-coffee text-white shadow-lg scale-105' 
                      : 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-700'
                    }
                  `}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                  {isActive && (
                    <div className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-1/2 h-1 gradient-emerald rounded-full"></div>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Desktop Auth */}
          <div className="hidden md:flex items-center space-x-4">
            {status === 'authenticated' && session?.user ? (
              <>
                <div className="flex items-center space-x-3 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-50 to-amber-50">
                  <div className="w-8 h-8 rounded-full gradient-emerald-coffee flex items-center justify-center text-white font-bold text-sm">
                    {session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    {session.user.name || session.user.email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="px-5 py-2.5 rounded-xl border-2 border-gray-300 text-sm font-semibold text-gray-700 transition-all hover:border-red-500 hover:text-red-600 hover:shadow-lg"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                href="/auth"
                className="px-6 py-2.5 rounded-xl gradient-emerald text-white font-semibold text-sm shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                <span>Sign In</span>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-3 rounded-xl glass hover:shadow-lg transition-all"
            onClick={() => setIsMobileMenuOpen(v => !v)}
            aria-label="Toggle menu"
          >
            <Icon label={isMobileMenuOpen ? '✕' : '☰'} />
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden glass border-t border-emerald-100 slide-in-up">
          <div className="px-4 pt-4 pb-6 space-y-3">
            {navItems.map(item => {
              const isActive = isActivePath(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-semibold
                    transition-all duration-300
                    ${isActive
                      ? 'gradient-emerald-coffee text-white shadow-lg'
                      : 'bg-white/50 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700'
                    }
                  `}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              )
            })}
            <div className="pt-3 border-t border-emerald-100">
              {status === 'authenticated' && session?.user ? (
                <>
                  <div className="flex items-center space-x-3 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-50 to-amber-50 mb-3">
                    <div className="w-10 h-10 rounded-full gradient-emerald-coffee flex items-center justify-center text-white font-bold">
                      {session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span className="text-sm font-medium text-gray-700">
                      {session.user.name || session.user.email}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="block w-full rounded-xl border-2 border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700 hover:border-red-500 hover:text-red-600 transition-all"
                    onClick={async () => {
                      setIsMobileMenuOpen(false)
                      await signOut({ callbackUrl: '/' })
                    }}
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <Link
                  href="/auth"
                  className="flex items-center justify-center space-x-2 w-full rounded-xl gradient-emerald px-4 py-3 text-center text-sm font-semibold text-white shadow-lg"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  <span>Sign In</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
