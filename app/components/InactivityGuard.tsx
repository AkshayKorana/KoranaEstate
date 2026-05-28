'use client'

import { useEffect, useRef, useState } from 'react'
import { signOut, useSession } from 'next-auth/react'

const IDLE_MS = 30 * 60 * 1000       // 30 minutes before warning
const WARNING_MS = 2 * 60 * 1000      // 2 minutes to act before sign-out
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const

export default function InactivityGuard() {
  const { status } = useSession()
  const [showWarning, setShowWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(WARNING_MS / 1000)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearAllTimers = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    if (warnTimer.current) clearTimeout(warnTimer.current)
    if (countdownInterval.current) clearInterval(countdownInterval.current)
  }

  const resetTimers = () => {
    clearAllTimers()
    setShowWarning(false)
    setSecondsLeft(WARNING_MS / 1000)

    idleTimer.current = setTimeout(() => {
      setShowWarning(true)
      setSecondsLeft(WARNING_MS / 1000)

      // Countdown display
      countdownInterval.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) {
            if (countdownInterval.current) clearInterval(countdownInterval.current)
            return 0
          }
          return s - 1
        })
      }, 1000)

      // Auto sign-out after warning period
      warnTimer.current = setTimeout(() => {
        void signOut({ callbackUrl: '/auth' })
      }, WARNING_MS)
    }, IDLE_MS)
  }

  useEffect(() => {
    if (status !== 'authenticated') return

    resetTimers()

    const handleActivity = () => {
      if (!showWarning) resetTimers()
    }

    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, handleActivity, { passive: true }))

    return () => {
      clearAllTimers()
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, handleActivity))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  if (status !== 'authenticated' || !showWarning) return null

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const countdown = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="mx-4 max-w-sm w-full rounded-2xl border p-6 shadow-2xl text-center"
        style={{ background: 'var(--lux-card-bg, #fff)', borderColor: 'var(--lux-navbar-border, rgba(0,0,0,0.1))' }}
      >
        {/* Icon */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>

        <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--lux-navbar-text, #1a1a1a)' }}>
          Still there?
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--lux-navbar-text-muted, #6b7280)' }}>
          You&apos;ve been inactive. You&apos;ll be signed out in{' '}
          <span className="font-bold text-amber-600">{countdown}</span> to keep your account secure.
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: '/auth' })}
            className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all hover:bg-red-50"
            style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#dc2626' }}
          >
            Sign Out
          </button>
          <button
            type="button"
            onClick={resetTimers}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all"
            style={{ background: '#059669' }}
          >
            Stay Signed In
          </button>
        </div>
      </div>
    </div>
  )
}
