export type UserRole = 'BUYER' | 'SELLER' | 'WORKER' | 'ADMIN'

export type ApiResponse<T> = {
  data: T
  message?: string
}

export type AuthTokens = {
  accessToken: string
  refreshToken?: string
}
