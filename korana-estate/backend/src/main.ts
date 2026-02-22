import { ValidationPipe, VersioningType } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { ThrottlerException, ThrottlerGuard } from '@nestjs/throttler'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.enableCors({
    origin: [process.env.WEB_ORIGIN ?? 'http://localhost:3000', process.env.MOBILE_ORIGIN ?? 'exp://localhost:8081'],
    credentials: true,
  })

  app.setGlobalPrefix('api')
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )
  app.useGlobalGuards(app.get(ThrottlerGuard))
  app.useGlobalFilters(new HttpExceptionFilter())

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Korana Estate API')
    .setDescription('Korana Estate SaaS backend API')
    .setVersion('1.0')
    .addBearerAuth()
    .build()
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('api/docs', app, swaggerDocument)

  const port = Number(process.env.PORT ?? 4000)
  await app.listen(port)
}

bootstrap().catch((error) => {
  if (error instanceof ThrottlerException) {
    process.exit(1)
  }
  throw error
})
