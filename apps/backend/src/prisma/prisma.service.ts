import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

function withRequiredSsl(url: string | undefined) {
  if (!url) return undefined

  // local postgres should NOT use SSL
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    return url
  }

  // if ssl already present, keep it
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
    const MAX_RETRIES = 5
    const DELAY_MS = 3000
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.$connect()
        console.log('Prisma connected to database.')
        return
      } catch (error) {
        console.error(`Prisma connection attempt ${attempt}/${MAX_RETRIES} failed.`, error)
        if (attempt < MAX_RETRIES) {
          await new Promise(res => setTimeout(res, DELAY_MS * attempt))
        } else {
          console.error('Prisma could not connect after all retries. Exiting.')
          process.exit(1)
        }
      }
    }
  }

  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit' as never, async () => {
      await app.close()
    })
  }
}