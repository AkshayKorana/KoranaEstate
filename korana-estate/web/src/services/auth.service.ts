import { apiRequest } from './api-client'

export type AuthPayload = { email: string; password: string; fullName?: string; role?: 'BUYER' | 'SELLER' | 'WORKER' }

export const authService = {
  register: (payload: AuthPayload) => apiRequest<{ accessToken: string; user: unknown }>('/auth/register', 'POST', payload),
  login: (payload: AuthPayload) => apiRequest<{ accessToken: string; user: unknown }>('/auth/login', 'POST', payload),
}
