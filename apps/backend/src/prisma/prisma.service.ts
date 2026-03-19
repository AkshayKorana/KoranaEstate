import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

function withRequiredSsl(url: string | undefined) {
  if (!url) return undefined
  if (/sslmode=/i.test(url)) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}sslmode=require`
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const datasourceUrl = withRequiredSsl(process.env.DATABASE_URL)

    super({
      log: ['error', 'warn'],
      ...(datasourceUrl
        ? {
            datasources: {
              db: {
                url: datasourceUrl,
              },
            },
          }
        : {}),
    })
  }

  async onModuleInit() {
    try {
      await this.$connect()
    } catch (error) {
      console.error('Prisma failed to connect during startup.', error)
      process.exit(1)
    }
  }

  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit' as never, async () => {
      await app.close()
    })
  }
}
