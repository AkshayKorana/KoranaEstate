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
    <div className="mx-auto mt-8 w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-md sm:p-8 dark:border-gray-700 dark:bg-gray-800">
      {showForgotPassword ? (
        <ForgotPasswordForm onCancel={handleBackToLogin} />
      ) : currentTab === 'reset-password' ? (
        <ResetPasswordForm onSuccess={handleBackToLogin} />
      ) : (
        <div>
          <div className="mb-8 grid w-full grid-cols-2 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
            <button
              type="button"
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                currentTab === 'login'
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
              }`}
            onClick={() => setCurrentTab('login')}
          >
              {t('Login', 'ಲಾಗಿನ್')}
            </button>
            <button
              type="button"
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                currentTab === 'signup'
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
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
