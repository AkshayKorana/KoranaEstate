export function deriveUserNames(input: { name?: string | null; email?: string | null }) {
  const trimmedName = typeof input.name === 'string' ? input.name.trim() : ''
  const email = (input.email ?? '').trim().toLowerCase()
  const emailLocal = email.includes('@') ? email.split('@')[0] : ''

  const display = trimmedName || emailLocal || 'User'
  return {
    name: trimmedName || null,
    fullName: display,
  }
}
