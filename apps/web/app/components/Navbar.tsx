'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useLanguage } from '@/app/language-context'
import { useTheme, useEffectiveTheme } from '@/app/theme-context'
import { handleSessionExpired, readResponsePayload, toChatApiError } from '@/app/lib/chat-client'

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
  { href: '/', label: { en: 'Home', kn: 'ಮುಖಪುಟ' } },
  { href: '/marketplace', label: { en: 'Marketplace', kn: 'ಮಾರುಕಟ್ಟೆ' } },
  { href: '/estate-marketplace', label: { en: 'Estate Essentials', kn: 'ಎಸ್ಟೇಟ್ ಅವಶ್ಯಕತೆಗಳು' } },
  { href: '/messages', label: { en: 'Messages', kn: 'ಸಂದೇಶಗಳು' } },
  { href: '/orders', label: { en: 'Orders', kn: 'ಆರ್ಡರ್‌ಗಳು' } },
  { href: '/home-stays', label: { en: 'Home Stays', kn: 'ಹೋಂ ಸ್ಟೇಸ್' } },
]

const HOME_STAYS_ENABLED = false

export default function Navbar() {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const { lang, setLang, t } = useLanguage()
  const { toggleTheme } = useTheme()
  const { isDark } = useEffectiveTheme()
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const visibleNavItems = HOME_STAYS_ENABLED ? navItems : navItems.filter((item) => item.href !== '/home-stays')

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
        const payload = await readResponsePayload<{ unreadCount?: number }>(res)
        if (!res.ok) {
          const error = toChatApiError(res, payload)
          console.error('Unread count failed', error.status, error.message)
          if (await handleSessionExpired(error)) {
            return
          }
          throw new Error(error.message)
        }
        if (mounted) {
          const count = Number(payload.data?.unreadCount)
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
  }, [status])

  const shownUnreadCount = status === 'authenticated' ? unreadCount : 0

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-lg" style={{ borderColor: 'var(--lux-navbar-border)', background: 'var(--lux-navbar-bg)' }}>
      <div className="mx-auto w-full max-w-7xl px-6 md:px-8 lg:px-10">
        <div className={`flex justify-between items-center py-4 md:py-5 transition-all duration-300 ${isScrolled || isMobileMenuOpen ? 'border-b border-emerald-200/10' : ''}`}>
          {/* Logo - Click to go Home */}
          <Link href="/" className="flex items-center space-x-3 group cursor-pointer" title="Go to Home">
            <div className="p-2 rounded-xl gradient-emerald-coffee group-hover:scale-110 transition-transform duration-300">
              <CoffeeIcon className="h-7 w-7 text-white" />
            </div>
            <div>
              <span className="font-luxe text-3xl font-bold text-brand-spectrum">
                Korana Estate
              </span>
              <p className="lux-muted text-xs -mt-1">Coffee and Spices</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1 rounded-2xl px-1 py-1 border" style={{ borderColor: 'var(--lux-navbar-border)', background: 'color-mix(in oklab, var(--lux-navbar-bg) 74%, transparent)' }}>
            {visibleNavItems.map(item => {
              const isActive = isActivePath(item.href)
              const isMessages = item.href === '/messages'
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    relative px-4 xl:px-5 py-3 rounded-xl font-semibold text-sm
                    transition-all duration-300 flex items-center space-x-2
                    ${isActive 
                      ? 'bg-emerald-700 text-white shadow-md' 
                      : 'hover:text-[var(--lux-navbar-text)] hover:bg-[var(--lux-navbar-hover)]'
                    }
                  `}
                  style={!isActive ? { color: 'var(--lux-navbar-text-muted)', backgroundColor: 'transparent' } : undefined}
                >
                  <span>{item.label[lang]}</span>
                  {isMessages && shownUnreadCount > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                      {shownUnreadCount > 99 ? '99+' : shownUnreadCount}
                    </span>
                  )}
                  {isActive && <div className="absolute -bottom-0.5 left-1/2 h-1 w-1/2 -translate-x-1/2 rounded-full bg-emerald-300" />}
                </Link>
              )
            })}
          </nav>

          {/* Desktop Auth */}
          <div className="hidden lg:flex items-center space-x-3 xl:space-x-4">
            <div className="lux-segment">
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`lux-segment-item ${lang === 'en' ? 'active' : ''}`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang('kn')}
                className={`lux-segment-item ${lang === 'kn' ? 'active' : ''}`}
              >
                ಕನ್ನಡ
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5" style={{ borderColor: 'var(--lux-navbar-border)', background: 'color-mix(in oklab, var(--lux-navbar-bg) 72%, transparent)' }}>
              <span className="text-xs font-semibold" style={{ color: 'var(--lux-navbar-text-muted)' }}>
                {isDark ? t('Dark', 'ಡಾರ್ಕ್') : t('Light', 'ಲೈಟ್')}
              </span>
              <button
                type="button"
                onClick={toggleTheme}
                className="lux-toggle"
                data-on={isDark}
                aria-label={isDark ? t('Switch to light', 'ಲೈಟ್‌ಗೆ ಬದಲಿಸಿ') : t('Switch to dark', 'ಡಾರ್ಕ್‌ಗೆ ಬದಲಿಸಿ')}
              >
                <span className="lux-toggle-thumb" />
              </button>
            </div>
            {status === 'authenticated' && session?.user ? (
              <>
                <div className="flex items-center space-x-3 px-4 py-2 rounded-xl border" style={{ borderColor: 'var(--lux-navbar-border)', background: 'color-mix(in oklab, var(--lux-navbar-bg) 80%, transparent)' }}>
                  <div className="w-8 h-8 rounded-full gradient-emerald-coffee flex items-center justify-center text-white font-bold text-sm">
                    {session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <span className="text-sm font-medium" style={{ color: 'var(--lux-navbar-text)' }}>
                    {session.user.name || session.user.email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="lux-btn-secondary px-5 py-2.5 rounded-xl text-sm font-semibold"
                >
                  {t('Sign Out', 'ಸೈನ್ ಔಟ್')}
                </button>
              </>
            ) : (
              <Link
                href="/auth"
                className="lux-btn-primary px-6 py-2.5 rounded-xl font-semibold text-sm shadow-lg flex items-center space-x-2"
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
            className="lg:hidden p-3 rounded-xl border transition-all"
            style={{
              borderColor: 'var(--lux-navbar-border)',
              background: isDark ? 'rgba(23,20,17,0.70)' : 'rgba(47,107,79,0.10)',
              color: isDark ? '#e8dccb' : 'var(--lux-navbar-text)',
            }}
            onClick={() => setIsMobileMenuOpen(v => !v)}
            aria-label="Toggle menu"
          >
            <Icon label={isMobileMenuOpen ? '✕' : '☰'} />
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden border-t"
          style={{
            background: isDark ? 'rgba(13,10,8,0.95)' : 'rgba(235,226,211,0.98)',
            borderColor: 'var(--lux-navbar-border)',
          }}
        >
          <div className="mx-auto max-w-7xl px-6 md:px-8 lg:px-10 pt-4 pb-6 space-y-3 slide-in-up">
            {visibleNavItems.map(item => {
              const isActive = isActivePath(item.href)
              const isMessages = item.href === '/messages'
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-semibold transition-all duration-300"
                  style={isActive
                    ? { background: '#2f6b4f', color: '#ffffff' }
                    : {
                        background: isDark ? 'rgba(23,20,17,0.75)' : 'rgba(47,107,79,0.08)',
                        color: isDark ? '#d8c8b3' : '#1f3a2a',
                      }
                  }
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <span>{item.label[lang]}</span>
                  {isMessages && shownUnreadCount > 0 && (
                    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                      {shownUnreadCount > 99 ? '99+' : shownUnreadCount}
                    </span>
                  )}
                </Link>
              )
            })}
            <div className="pt-3 border-t" style={{ borderColor: isDark ? 'rgba(110,178,144,0.30)' : 'rgba(47,107,79,0.20)' }}>
              <div className="lux-segment mb-3 w-full">
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  className={`lux-segment-item flex-1 ${lang === 'en' ? 'active' : ''}`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLang('kn')}
                  className={`lux-segment-item flex-1 ${lang === 'kn' ? 'active' : ''}`}
                >
                  ಕನ್ನಡ
                </button>
              </div>
              <div
                className="mb-3 flex items-center justify-between rounded-lg border px-3 py-2"
                style={{
                  borderColor: 'var(--lux-navbar-border)',
                  background: isDark ? 'rgba(23,20,17,0.55)' : 'rgba(47,107,79,0.06)',
                }}
              >
                <span className="text-sm font-semibold" style={{ color: 'var(--lux-navbar-text-muted)' }}>
                  {isDark ? t('Dark Mode', 'ಡಾರ್ಕ್ ಮೋಡ್') : t('Light Mode', 'ಲೈಟ್ ಮೋಡ್')}
                </span>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="lux-toggle"
                  data-on={isDark}
                  aria-label={isDark ? t('Switch to light', 'ಲೈಟ್‌ಗೆ ಬದಲಿಸಿ') : t('Switch to dark', 'ಡಾರ್ಕ್‌ಗೆ ಬದಲಿಸಿ')}
                >
                  <span className="lux-toggle-thumb" />
                </button>
              </div>
              {status === 'authenticated' && session?.user ? (
                <>
                  <div
                    className="flex items-center space-x-3 px-4 py-3 rounded-xl mb-3 border"
                    style={{
                      background: isDark ? 'linear-gradient(to right, rgba(6,78,59,0.5), rgba(120,53,15,0.3))' : 'rgba(47,107,79,0.10)',
                      borderColor: 'var(--lux-navbar-border)',
                    }}
                  >
                    <div className="w-10 h-10 rounded-full gradient-emerald-coffee flex items-center justify-center text-white font-bold">
                      {session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--lux-navbar-text)' }}>
                      {session.user.name || session.user.email}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="lux-btn-secondary block w-full rounded-xl px-4 py-3 text-center text-sm font-semibold"
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
                  className="lux-btn-primary flex items-center justify-center space-x-2 w-full rounded-xl px-4 py-3 text-center text-sm font-semibold shadow-lg"
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
