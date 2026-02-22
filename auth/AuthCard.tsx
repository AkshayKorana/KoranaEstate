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
    <div className="mx-auto mt-8 w-full max-w-lg rounded-3xl border border-emerald-200/30 glass p-6 shadow-2xl sm:p-8">
      {showForgotPassword ? (
        <ForgotPasswordForm onCancel={handleBackToLogin} />
      ) : currentTab === 'reset-password' ? (
        <ResetPasswordForm onSuccess={handleBackToLogin} />
      ) : (
        <div>
          <div className="mb-8 grid w-full grid-cols-2 rounded-xl bg-[#1a1411]/80 p-1 border border-emerald-200/20">
            <button
              type="button"
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                currentTab === 'login'
                  ? 'bg-[#2b3b31] text-[#f3e8d7] shadow-sm'
                  : 'text-[#c3b5a2] hover:text-[#f3e8d7]'
              }`}
            onClick={() => setCurrentTab('login')}
          >
              {t('Login', 'ಲಾಗಿನ್')}
            </button>
            <button
              type="button"
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                currentTab === 'signup'
                  ? 'bg-[#2b3b31] text-[#f3e8d7] shadow-sm'
                  : 'text-[#c3b5a2] hover:text-[#f3e8d7]'
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
