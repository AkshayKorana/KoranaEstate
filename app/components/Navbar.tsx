'use client'

import { useEffect, useRef, useState } from 'react'
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
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  const isActivePath = (path: string) => (path.startsWith('/#') ? pathname === '/' : pathname === path)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!isProfileOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isProfileOpen])

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
    }, 5000)

    // Immediately refresh when messages are marked read
    const onMessagesRead = () => void loadUnreadCount()
    window.addEventListener('korana:messages-read', onMessagesRead)

    return () => {
      mounted = false
      clearInterval(interval)
      window.removeEventListener('korana:messages-read', onMessagesRead)
    }
  }, [status, pathname])

  const shownUnreadCount = status === 'authenticated' ? unreadCount : 0

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-lg" style={{ borderColor: 'var(--lux-navbar-border)', background: 'var(--lux-navbar-bg)' }}>
      <div className="mx-auto w-full max-w-7xl px-6 md:px-8 lg:px-10">
        <div className={`flex justify-between items-center py-4 md:py-5 transition-all duration-300 ${isScrolled || isMobileMenuOpen ? 'border-b border-emerald-200/10' : ''}`}>
          {/* Logo - Click to go Home */}
          <Link href="/" className="flex items-center space-x-3 group cursor-pointer" title="Go to Home">
            <div className="p-2 rounded-xl gradient-emerald-coffee group-hover:scale-110 transition-transform duration-300 float-animation">
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
            {navItems.map(item => {
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
                  <span className="text-lg">{item.icon}</span>
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
                {theme === 'dark' ? t('Dark', 'ಡಾರ್ಕ್') : t('Light', 'ಲೈಟ್')}
              </span>
              <button
                type="button"
                onClick={toggleTheme}
                className="lux-toggle"
                data-on={theme === 'dark'}
                aria-label={theme === 'dark' ? t('Switch to light', 'ಲೈಟ್‌ಗೆ ಬದಲಿಸಿ') : t('Switch to dark', 'ಡಾರ್ಕ್‌ಗೆ ಬದಲಿಸಿ')}
              >
                <span className="lux-toggle-thumb" />
              </button>
            </div>
            {status === 'authenticated' && session?.user ? (
              <>
                <div ref={profileRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsProfileOpen(v => !v)}
                    className="flex items-center space-x-3 px-4 py-2 rounded-xl border transition-all hover:opacity-90 cursor-pointer"
                    style={{ borderColor: 'var(--lux-navbar-border)', background: 'color-mix(in oklab, var(--lux-navbar-bg) 80%, transparent)' }}
                  >
                    <div className="w-8 h-8 rounded-full gradient-emerald-coffee flex items-center justify-center text-white font-bold text-sm">
                      {session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--lux-navbar-text)' }}>
                      {session.user.name || session.user.email}
                    </span>
                    <svg className={`w-4 h-4 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--lux-navbar-text-muted)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isProfileOpen && (
                    <div
                      className="absolute right-0 mt-2 w-64 rounded-2xl border shadow-xl z-50 overflow-hidden"
                      style={{
                        background: theme === 'dark' ? '#1a1410' : '#ffffff',
                        borderColor: theme === 'dark' ? 'rgba(110,178,144,0.25)' : 'rgba(47,107,79,0.15)',
                      }}
                    >
                      <div className="px-5 py-4" style={{ borderColor: theme === 'dark' ? 'rgba(110,178,144,0.15)' : 'rgba(47,107,79,0.10)' }}>
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full gradient-emerald-coffee flex items-center justify-center text-white font-bold text-base flex-shrink-0">
                            {session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase() || 'U'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: theme === 'dark' ? '#f2e7d8' : '#1f2d24' }}>
                              {session.user.name || '—'}
                            </p>
                            <p className="text-xs truncate mt-0.5" style={{ color: theme === 'dark' ? '#9fb8a8' : '#4b7060' }}>
                              {session.user.email}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
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
            className="lg:hidden p-3 rounded-xl border border-emerald-200/25 bg-[#171411]/70 hover:bg-[#1f1a16] transition-all text-[#e8dccb]"
            onClick={() => setIsMobileMenuOpen(v => !v)}
            aria-label="Toggle menu"
          >
            <Icon label={isMobileMenuOpen ? '✕' : '☰'} />
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-emerald-200/15 bg-[rgba(13,10,8,0.92)]">
          <div className="mx-auto max-w-7xl px-6 md:px-8 lg:px-10 pt-4 pb-6 space-y-3 slide-in-up">
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
                      ? 'bg-emerald-700 text-white shadow-md'
                      : 'bg-[#171411]/75 text-[#d8c8b3] hover:bg-emerald-900/25 hover:text-[#e9dcc9]'
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
            <div className="pt-3 border-t border-emerald-200/30">
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
              <div className="mb-3 flex items-center justify-between rounded-lg border border-emerald-200/20 bg-[#171411]/55 px-3 py-2">
                <span className="text-sm font-semibold text-[#d8c8b3]">
                  {theme === 'dark' ? t('Dark Mode', 'ಡಾರ್ಕ್ ಮೋಡ್') : t('Light Mode', 'ಲೈಟ್ ಮೋಡ್')}
                </span>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="lux-toggle"
                  data-on={theme === 'dark'}
                  aria-label={theme === 'dark' ? t('Switch to light', 'ಲೈಟ್‌ಗೆ ಬದಲಿಸಿ') : t('Switch to dark', 'ಡಾರ್ಕ್‌ಗೆ ಬದಲಿಸಿ')}
                >
                  <span className="lux-toggle-thumb" />
                </button>
              </div>
              {status === 'authenticated' && session?.user ? (
                <>
                  <div className="flex items-center space-x-3 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-950/50 to-amber-900/30 mb-3 border border-emerald-200/20">
                    <div className="w-10 h-10 rounded-full gradient-emerald-coffee flex items-center justify-center text-white font-bold">
                      {session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span className="text-sm font-medium text-[#e6d8c5]">
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
