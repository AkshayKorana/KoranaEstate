import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000/api/v1'

type BackendAuthResponse = {
  user?: {
    id: string
    email: string
    fullName?: string | null
    role?: string | null
  }
  accessToken?: string
  refreshToken?: string
}

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase()
        const password = credentials?.password

        if (!email || !password) return null

        const response = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          cache: 'no-store',
        })

        const text = await response.text()
        let data: BackendAuthResponse = {}

        try {
          data = text ? (JSON.parse(text) as BackendAuthResponse) : {}
        } catch {
          data = {}
        }

        if (!response.ok || !data.user || !data.accessToken) {
          return null
        }

        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.fullName ?? undefined,
          role: data.user.role ?? undefined,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id
        token.email = user.email
        token.name = user.name
        token.role = user.role
        token.accessToken = user.accessToken
        token.refreshToken = user.refreshToken
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub
        session.user.email = token.email ?? session.user.email
        session.user.name = token.name ?? session.user.name
        session.user.role = typeof token.role === 'string' ? token.role : undefined
      }
      session.accessToken = typeof token.accessToken === 'string' ? token.accessToken : undefined
      session.refreshToken = typeof token.refreshToken === 'string' ? token.refreshToken : undefined
      return session
    },
  },
  pages: {
    signIn: '/auth',
  },
  secret: process.env.NEXTAUTH_SECRET,
}
