import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const adminHash = await bcrypt.hash('Admin@1234', 12)
  await prisma.user.upsert({
    where: { email: 'admin@koranaestate.com' },
    update: {},
    create: {
      email: 'admin@koranaestate.com',
      fullName: 'Korana Admin',
      passwordHash: adminHash,
      role: UserRole.ADMIN,
      sellerVerified: true,
    },
  })
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
