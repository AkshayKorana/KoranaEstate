import { cloneElement, ReactElement, useState } from 'react'
import ForgotPasswordForm from './ForgotPasswordForm'
import ResetPasswordForm from './ResetPasswordForm'
import { useLanguage } from '@/app/language-context'

type AuthTab = 'login' | 'signup' | 'reset-password'

interface AuthCardProps {
  loginForm: ReactElement<{ onForgotPassword?: () => void }>
  signupForm: ReactElement
  defaultTab?: string
}

export default function AuthCard({ loginForm, signupForm, defaultTab = 'login' }: AuthCardProps) {
  const { t } = useLanguage()
  const initialTab: AuthTab = defaultTab === 'signup' || defaultTab === 'reset-password' ? defaultTab : 'login'
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [currentTab, setCurrentTab] = useState<AuthTab>(initialTab)

  const handleBackToLogin = () => {
    setShowForgotPassword(false)
    setCurrentTab('login')
  }

  return (
    <div className="mx-auto mt-8 w-full max-w-lg rounded-3xl border border-black/10 p-6 shadow-[0_8px_24px_rgba(0,0,0,0.08)] sm:p-8 dark:border-emerald-200/30 dark:glass dark:shadow-2xl">
      {showForgotPassword ? (
        <ForgotPasswordForm onCancel={handleBackToLogin} />
      ) : currentTab === 'reset-password' ? (
        <ResetPasswordForm onSuccess={handleBackToLogin} />
      ) : (
        <div>
          <div className="mb-8 grid w-full grid-cols-2 rounded-xl border border-black/10 bg-[#f3ede4] p-1 dark:border-emerald-200/20 dark:bg-[#1a1411]/80">
            <button
              type="button"
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                currentTab === 'login'
                  ? 'bg-[#2f6b4f] text-white shadow-sm dark:bg-[#2b3b31] dark:text-[#f3e8d7]'
                  : 'text-[#4a4a4a] hover:text-[#1f4d3a] dark:text-[#c3b5a2] dark:hover:text-[#f3e8d7]'
              }`}
            onClick={() => setCurrentTab('login')}
          >
              {t('Login', 'ಲಾಗಿನ್')}
            </button>
            <button
              type="button"
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                currentTab === 'signup'
                  ? 'bg-[#2f6b4f] text-white shadow-sm dark:bg-[#2b3b31] dark:text-[#f3e8d7]'
                  : 'text-[#4a4a4a] hover:text-[#1f4d3a] dark:text-[#c3b5a2] dark:hover:text-[#f3e8d7]'
              }`}
            onClick={() => setCurrentTab('signup')}
          >
              {t('Sign Up', 'ಸೈನ್ ಅಪ್')}
            </button>
          </div>

          {currentTab === 'login' ? cloneElement(loginForm, { onForgotPassword: () => setShowForgotPassword(true) }) : signupForm}
        </div>
      )}
    </div>
  )
}
