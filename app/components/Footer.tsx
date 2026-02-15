import type { ReactNode } from 'react'
import Link from 'next/link'

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
      className="p-2 rounded-full hover:bg-coffee-100 dark:hover:bg-coffee-800 transition-all"
    >
      {children}
    </a>
  )
}

export default function Footer() {
  return (
    <footer className="bg-coffee-50 dark:bg-coffee-900/30 pt-16 pb-8 border-t border-coffee-100 dark:border-coffee-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 mb-12">
          <div className="space-y-4">
            <Link href="/" className="flex items-center space-x-2 text-primary">
              <CoffeeIcon className="h-7 w-7" />
              <span className="text-xl font-semibold">Korana Estate</span>
            </Link>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
              The premier marketplace for coffee plantation products and services in Kodagu, Karnataka.
              Connecting farmers, suppliers, and consumers.
            </p>
            <div className="flex space-x-4 pt-2">
              <SocialIcon href="https://facebook.com" label="Facebook">
                <span className="h-5 w-5 text-coffee-600 dark:text-coffee-400">f</span>
              </SocialIcon>
              <SocialIcon href="https://instagram.com" label="Instagram">
                <span className="h-5 w-5 text-coffee-600 dark:text-coffee-400">in</span>
              </SocialIcon>
              <SocialIcon href="https://twitter.com" label="Twitter">
                <span className="h-5 w-5 text-coffee-600 dark:text-coffee-400">x</span>
              </SocialIcon>
            </div>
          </div>

          <div>
            <h3 className="text-md font-semibold mb-4 text-gray-900 dark:text-gray-100">Quick Links</h3>
            <ul className="space-y-2">
              <li><Link href="/" className="text-gray-600 dark:text-gray-400 hover:text-coffee-600 dark:hover:text-coffee-400 transition-all">Home</Link></li>
              <li><Link href="/marketplace" className="text-gray-600 dark:text-gray-400 hover:text-coffee-600 dark:hover:text-coffee-400 transition-all">Marketplace</Link></li>
              <li><Link href="/services" className="text-gray-600 dark:text-gray-400 hover:text-coffee-600 dark:hover:text-coffee-400 transition-all">Services</Link></li>
              <li><Link href="/about" className="text-gray-600 dark:text-gray-400 hover:text-coffee-600 dark:hover:text-coffee-400 transition-all">About Us</Link></li>
              <li><Link href="/contact" className="text-gray-600 dark:text-gray-400 hover:text-coffee-600 dark:hover:text-coffee-400 transition-all">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-md font-semibold mb-4 text-gray-900 dark:text-gray-100">Contact Us</h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <MailIcon className="h-5 w-5 mr-3 text-coffee-600 dark:text-coffee-400 mt-0.5" />
                <span className="text-gray-600 dark:text-gray-400">akshay.koranaest@gmail.com</span>
              </li>
              <li className="flex items-start">
                <PhoneIcon className="h-5 w-5 mr-3 text-coffee-600 dark:text-coffee-400 mt-0.5" />
                <span className="text-gray-600 dark:text-gray-400">+91 7624848646</span>
              </li>
              <li className="text-gray-600 dark:text-gray-400 mt-2">
                <p>Madikeri,</p>
                <p>Kodagu District,</p>
                <p>Karnataka, India</p>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-coffee-100 dark:border-coffee-800 text-center">
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            &copy; {new Date().getFullYear()} Korana Estate Marketplace. All rights reserved.
          </p>
          <div className="mt-2 flex justify-center space-x-4 text-sm text-gray-500 dark:text-gray-500">
            <Link href="/privacy" className="hover:text-coffee-600 dark:hover:text-coffee-400 transition-all">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-coffee-600 dark:hover:text-coffee-400 transition-all">Terms of Service</Link>
            <Link href="/faq" className="hover:text-coffee-600 dark:hover:text-coffee-400 transition-all">FAQ</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
