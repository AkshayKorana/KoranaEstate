import { getToken } from '../lib/token-store'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1'

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export async function apiRequest<T>(path: string, method: Method = 'GET', body?: unknown): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}
