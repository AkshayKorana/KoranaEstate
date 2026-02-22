'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useLanguage } from '@/app/language-context'
import { useTheme } from '@/app/theme-context'

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
  { href: '/', label: { en: 'Home', kn: 'ಮುಖಪುಟ' }, icon: '🏠' },
  { href: '/raw-marketplace', label: { en: 'Raw Marketplace', kn: 'ರಾ ಮಾರುಕಟ್ಟೆ' }, icon: '🌱' },
  { href: '/estate-marketplace', label: { en: 'Estate Essentials', kn: 'ಎಸ್ಟೇಟ್ ಅವಶ್ಯಕತೆಗಳು' }, icon: '🚜' },
  { href: '/store', label: { en: 'Store', kn: 'ಸ್ಟೋರ್' }, icon: '🛒' },
  { href: '/messages', label: { en: 'Messages', kn: 'ಸಂದೇಶಗಳು' }, icon: '💬' },
]

export default function Navbar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const { lang, setLang, t } = useLanguage()
  const { theme, toggleTheme } = useTheme()
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const isActivePath = (path: string) => (path.startsWith('/#') ? pathname === '/' : pathname === path)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') {
      return
    }

    let mounted = true
    const loadUnreadCount = async () => {
      try {
        const res = await fetch('/api/chat/unread-count', { cache: 'no-store' })
        const data = await res.json()
        if (mounted) {
          const count = Number(data?.unreadCount)
          setUnreadCount(Number.isFinite(count) ? count : 0)
        }
      } catch {
        if (mounted) setUnreadCount(0)
      }
    }

    void loadUnreadCount()
    const interval = setInterval(() => {
      void loadUnreadCount()
    }, 10000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [status, pathname])

  const shownUnreadCount = status === 'authenticated' ? unreadCount : 0

  return (
    <header
      className="fixed top-3 left-0 right-0 z-50 px-3 md:px-6"
    >
      <div
        className={`mx-auto max-w-7xl rounded-2xl transition-all duration-500 ${
          isScrolled || isMobileMenuOpen
            ? 'glass shadow-xl border border-emerald-100 dark:border-slate-700'
            : 'bg-white/75 backdrop-blur-md border border-white/40 dark:bg-slate-900/75 dark:border-slate-700/60'
        }`}
      >
        <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4 md:py-5">
          {/* Logo - Click to go Home */}
          <Link href="/" className="flex items-center space-x-3 group cursor-pointer" title="Go to Home">
            <div className="p-2 rounded-xl gradient-emerald-coffee group-hover:scale-110 transition-transform duration-300 float-animation">
              <CoffeeIcon className="h-7 w-7 text-white" />
            </div>
            <div>
              <span className="text-2xl font-bold text-brand-spectrum">
                Korana Estate
              </span>
              <p className="text-xs text-emerald-900/80 dark:text-emerald-200/90 -mt-1">Coffee and Spices</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-2 bg-white/50 backdrop-blur-sm rounded-2xl px-2 py-2 shadow-lg dark:bg-slate-800/60">
            {navItems.map(item => {
              const isActive = isActivePath(item.href)
              const isMessages = item.href === '/messages'
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    relative px-6 py-2.5 rounded-xl font-semibold text-sm
                    transition-all duration-300 flex items-center space-x-2
                    ${isActive 
                      ? 'gradient-brand-spectrum text-white shadow-lg scale-105' 
                      : 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 dark:text-gray-200 dark:hover:bg-slate-700 dark:hover:text-emerald-300'
                    }
                  `}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label[lang]}</span>
                  {isMessages && shownUnreadCount > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                      {shownUnreadCount > 99 ? '99+' : shownUnreadCount}
                    </span>
                  )}
                  {isActive && (
                    <div className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-1/2 h-1 gradient-emerald rounded-full"></div>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Desktop Auth */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1 dark:border-gray-600 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-3 py-1 text-xs font-semibold rounded ${lang === 'en' ? 'bg-emerald-600 text-white' : 'text-gray-700 dark:text-gray-200'}`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang('kn')}
                className={`px-3 py-1 text-xs font-semibold rounded ${lang === 'kn' ? 'bg-emerald-600 text-white' : 'text-gray-700 dark:text-gray-200'}`}
              >
                ಕನ್ನಡ
              </button>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-slate-800 dark:text-gray-200 dark:hover:bg-slate-700"
            >
              {theme === 'dark' ? t('Light', 'ಲೈಟ್') : t('Dark', 'ಡಾರ್ಕ್')}
            </button>
            {status === 'authenticated' && session?.user ? (
              <>
                <div className="flex items-center space-x-3 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-50 to-amber-50">
                  <div className="w-8 h-8 rounded-full gradient-emerald-coffee flex items-center justify-center text-white font-bold text-sm">
                    {session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {session.user.name || session.user.email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="px-5 py-2.5 rounded-xl border-2 border-gray-300 text-sm font-semibold text-gray-700 transition-all hover:border-red-500 hover:text-red-600 hover:shadow-lg"
                >
                  {t('Sign Out', 'ಸೈನ್ ಔಟ್')}
                </button>
              </>
            ) : (
              <Link
                href="/auth"
                className="px-6 py-2.5 rounded-xl gradient-brand-spectrum text-white font-semibold text-sm shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                <span>{t('Sign In', 'ಸೈನ್ ಇನ್')}</span>
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
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden mt-2 mx-auto max-w-7xl rounded-2xl glass border border-emerald-100 dark:border-slate-700 slide-in-up">
          <div className="px-4 pt-4 pb-6 space-y-3">
            {navItems.map(item => {
              const isActive = isActivePath(item.href)
              const isMessages = item.href === '/messages'
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-semibold
                    transition-all duration-300
                    ${isActive
                      ? 'gradient-brand-spectrum text-white shadow-lg'
                      : 'bg-white/50 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-slate-800/70 dark:text-gray-200 dark:hover:bg-slate-700 dark:hover:text-emerald-300'
                    }
                  `}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span>{item.label[lang]}</span>
                  {isMessages && shownUnreadCount > 0 && (
                    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                      {shownUnreadCount > 99 ? '99+' : shownUnreadCount}
                    </span>
                  )}
                </Link>
              )
            })}
            <div className="pt-3 border-t border-emerald-100">
              <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1 mb-3 w-full dark:border-gray-600 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  className={`flex-1 px-3 py-2 text-xs font-semibold rounded ${lang === 'en' ? 'bg-emerald-600 text-white' : 'text-gray-700 dark:text-gray-200'}`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLang('kn')}
                  className={`flex-1 px-3 py-2 text-xs font-semibold rounded ${lang === 'kn' ? 'bg-emerald-600 text-white' : 'text-gray-700 dark:text-gray-200'}`}
                >
                  ಕನ್ನಡ
                </button>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="mb-3 block w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-center text-sm font-semibold text-gray-700 dark:border-gray-600 dark:bg-slate-800 dark:text-gray-200"
              >
                {theme === 'dark' ? t('Switch to Light', 'ಲೈಟ್‌ಗೆ ಬದಲಿಸಿ') : t('Switch to Dark', 'ಡಾರ್ಕ್‌ಗೆ ಬದಲಿಸಿ')}
              </button>
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
                    {t('Sign Out', 'ಸೈನ್ ಔಟ್')}
                  </button>
                </>
              ) : (
                <Link
                  href="/auth"
                  className="flex items-center justify-center space-x-2 w-full rounded-xl gradient-brand-spectrum px-4 py-3 text-center text-sm font-semibold text-white shadow-lg"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  <span>{t('Sign In', 'ಸೈನ್ ಇನ್')}</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
