import { request, setAuthToken } from './api'

type LoginInput = { email: string; password: string }

type AuthResponse = { accessToken: string; user: { id: string; fullName: string; role: string } }

export async function login(input: LoginInput) {
  const data = await request<AuthResponse>('/auth/login', 'POST', input)
  setAuthToken(data.accessToken)
  return data
}
