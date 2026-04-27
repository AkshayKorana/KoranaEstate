import { INestApplication, Injectable, Logger, OnModuleInit } from '@nestjs/common'
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
  private readonly logger = new Logger(PrismaService.name)

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
    // Connect lazily — attempt in background so the app boots even if DB is temporarily unreachable.
    // Individual requests will fail with 500s until DB is available rather than crashing the process.
    const MAX_RETRIES = 5
    const DELAY_MS = 3000
    const connect = async () => {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          await this.$connect()
          this.logger.log('Prisma connected to database.')
          return
        } catch (error) {
          this.logger.error(`Prisma connection attempt ${attempt}/${MAX_RETRIES} failed.`, error)
          if (attempt < MAX_RETRIES) {
            await new Promise(res => setTimeout(res, DELAY_MS * attempt))
          } else {
            this.logger.error('Prisma could not connect after all retries. Requests requiring DB will fail until reconnected.')
          }
        }
      }
    }
    // Fire-and-forget: do not await so the app starts up immediately
    connect().catch(() => {/* already logged */})
  }

  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit' as never, async () => {
      await app.close()
    })
  }
}