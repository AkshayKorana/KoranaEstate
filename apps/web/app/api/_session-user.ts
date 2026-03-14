import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { deriveUserNames } from '@/lib/user-name'

export async function requireSessionUser() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email?.trim().toLowerCase()
  const sessionUserId = session?.user?.id

  if (!email) {
    return null
  }

  const sessionName = session?.user?.name ?? null
  const names = deriveUserNames({ name: sessionName, email })
  const existing = await prisma.user.findUnique({ where: { email } })

  if (existing) {
    return prisma.user.update({
      where: { email },
      data: {
        name: names.name ?? undefined,
        fullName: names.fullName,
      },
      select: {
        id: true,
        name: true,
        fullName: true,
        email: true,
      },
    })
  }

  return prisma.user.create({
    data: {
      id: typeof sessionUserId === 'string' && sessionUserId ? sessionUserId : undefined,
      email,
      name: names.name,
      fullName: names.fullName,
      passwordHash: 'oauth_user_no_password',
    },
    select: {
      id: true,
      name: true,
      fullName: true,
      email: true,
    },
  })
}
