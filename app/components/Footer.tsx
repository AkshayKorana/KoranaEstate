"use client"

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/app/language-context'

function CoffeeIcon({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M3 8h12v5a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8Z" />
      <path d="M15 10h2a3 3 0 0 1 0 6h-2" />
      <path d="M7 3h2" />
      <path d="M11 3h2" />
    </svg>
  )
}

function MailIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  )
}

function PhoneIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6.2 6.2l1.4-1.3a2 2 0 0 1 2.1-.5c.8.3 1.7.6 2.6.7A2 2 0 0 1 22 16.9Z" />
    </svg>
  )
}

type SocialIconProps = { href: string; label: string; children: ReactNode }

function SocialIcon({ href, label, children }: SocialIconProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="p-2 rounded-full hover:bg-emerald-100 dark:hover:bg-slate-800 transition-all"
    >
      {children}
    </a>
  )
}

export default function Footer() {
  const { t } = useLanguage()

  return (
    <footer id="site-footer" className="bg-white/95 pt-16 pb-8 border-t border-stone-200 dark:bg-slate-950/95 dark:border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 mb-12">
          <div id="footer-brand-target" className="space-y-4 target-highlight">
            <Link href="/#top" className="flex items-center space-x-2 text-stone-900 dark:text-stone-100">
              <CoffeeIcon className="h-7 w-7 text-emerald-700 dark:text-emerald-300" />
              <span className="text-xl font-bold tracking-tight">Korana Estate</span>
            </Link>
            <p id="footer-about-text" className="text-stone-700 dark:text-stone-300 text-sm leading-relaxed target-highlight">
              {t(
                'The premier marketplace for coffee plantation products and services in Kodagu, Karnataka. Connecting farmers, suppliers, and consumers.',
                'ಕೊಡಗು, ಕರ್ನಾಟಕದಲ್ಲಿ ಕಾಫಿ ತೋಟದ ಉತ್ಪನ್ನಗಳು ಮತ್ತು ಸೇವೆಗಳ ಪ್ರಮುಖ ಮಾರುಕಟ್ಟೆ. ರೈತರು, ಸರಬರಾಜುದಾರರು ಮತ್ತು ಗ್ರಾಹಕರನ್ನು ಸಂಪರ್ಕಿಸುತ್ತದೆ.'
              )}
            </p>
            <div className="flex space-x-4 pt-2">
              <SocialIcon href="https://facebook.com" label="Facebook">
                <span className="h-5 w-5 text-stone-700 dark:text-stone-200">f</span>
              </SocialIcon>
              <SocialIcon href="https://instagram.com" label="Instagram">
                <span className="h-5 w-5 text-stone-700 dark:text-stone-200">in</span>
              </SocialIcon>
              <SocialIcon href="https://twitter.com" label="Twitter">
                <span className="h-5 w-5 text-stone-700 dark:text-stone-200">x</span>
              </SocialIcon>
            </div>
          </div>

          <div>
            <h3 className="text-md font-bold mb-4 text-stone-900 dark:text-stone-100">{t('Quick Links', 'ತ್ವರಿತ ಲಿಂಕ್‌ಗಳು')}</h3>
            <ul className="space-y-2">
              <li><Link href="/#top" className="text-stone-700 dark:text-stone-300 hover:text-emerald-700 dark:hover:text-emerald-300 transition-all">{t('Home', 'ಮುಖಪುಟ')}</Link></li>
              <li><Link href="/raw-marketplace" className="text-stone-700 dark:text-stone-300 hover:text-emerald-700 dark:hover:text-emerald-300 transition-all">{t('Raw marketplace', 'ರಾ ಮಾರುಕಟ್ಟೆ')}</Link></li>
              <li><Link href="/estate-marketplace" className="text-stone-700 dark:text-stone-300 hover:text-emerald-700 dark:hover:text-emerald-300 transition-all">{t('Estate essentials', 'ಎಸ್ಟೇಟ್ ಅವಶ್ಯಕತೆಗಳು')}</Link></li>
              <li><Link href="/store" className="text-stone-700 dark:text-stone-300 hover:text-emerald-700 dark:hover:text-emerald-300 transition-all">{t('Store', 'ಸ್ಟೋರ್')}</Link></li>
              <li><Link href="/#footer-about-text" className="text-stone-700 dark:text-stone-300 hover:text-emerald-700 dark:hover:text-emerald-300 transition-all">{t('About us', 'ನಮ್ಮ ಬಗ್ಗೆ')}</Link></li>
              <li><Link href="/#footer-contact-target" className="text-stone-700 dark:text-stone-300 hover:text-emerald-700 dark:hover:text-emerald-300 transition-all">{t('Contact', 'ಸಂಪರ್ಕ')}</Link></li>
            </ul>
          </div>

          <div id="footer-contact-target" className="target-highlight">
            <h3 className="text-md font-bold mb-4 text-stone-900 dark:text-stone-100">{t('Contact Us', 'ನಮ್ಮನ್ನು ಸಂಪರ್ಕಿಸಿ')}</h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <MailIcon className="h-5 w-5 mr-3 text-emerald-700 dark:text-emerald-300 mt-0.5" />
                <span className="text-stone-700 dark:text-stone-300">akshay.koranaest@gmail.com</span>
              </li>
              <li className="flex items-start">
                <PhoneIcon className="h-5 w-5 mr-3 text-emerald-700 dark:text-emerald-300 mt-0.5" />
                <span className="text-stone-700 dark:text-stone-300">+91 7624848646</span>
              </li>
              <li className="text-stone-700 dark:text-stone-300 mt-2">
                <p>Madikeri,</p>
                <p>{t('Kodagu District,', 'ಕೊಡಗು ಜಿಲ್ಲೆ,')}</p>
                <p>Karnataka, India</p>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-coffee-100 dark:border-coffee-800 text-center">
          <p className="text-stone-700 dark:text-stone-300 text-sm">
            &copy; {new Date().getFullYear()} {t('Korana Estate Marketplace. All rights reserved.', 'ಕೊರಾನಾ ಎಸ್ಟೇಟ್ ಮಾರುಕಟ್ಟೆ. ಎಲ್ಲಾ ಹಕ್ಕುಗಳು ಕಾಯ್ದಿರಿಸಲಾಗಿದೆ.')}
          </p>
          <div className="mt-2 flex justify-center space-x-4 text-sm text-stone-600 dark:text-stone-300">
            <Link href="/privacy" className="hover:text-emerald-700 dark:hover:text-emerald-300 transition-all">{t('Privacy Policy', 'ಗೌಪ್ಯತಾ ನೀತಿ')}</Link>
            <Link href="/terms" className="hover:text-emerald-700 dark:hover:text-emerald-300 transition-all">{t('Terms of Service', 'ಸೇವಾ ನಿಯಮಗಳು')}</Link>
            <Link href="/faq" className="hover:text-emerald-700 dark:hover:text-emerald-300 transition-all">FAQ</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
