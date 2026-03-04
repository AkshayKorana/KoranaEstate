import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    accessToken?: string
    refreshToken?: string
    user: {
      id?: string
      role?: string
    } & DefaultSession['user']
  }

  interface User {
    id: string
    role?: string
    accessToken?: string
    refreshToken?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string
    accessToken?: string
    refreshToken?: string
  }
}

export {}
