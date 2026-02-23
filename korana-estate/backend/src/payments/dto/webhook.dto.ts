import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator'

enum Provider {
  RAZORPAY = 'RAZORPAY',
  STRIPE = 'STRIPE',
}

enum IncomingStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export class PaymentWebhookDto {
  @ApiProperty({ enum: Provider })
  @IsEnum(Provider)
  provider!: Provider

  @ApiProperty()
  @IsString()
  providerPaymentId!: string

  @ApiProperty({ enum: IncomingStatus })
  @IsEnum(IncomingStatus)
  status!: IncomingStatus

  @ApiProperty()
  @IsString()
  orderId!: string

  @ApiProperty({ example: 1200.5 })
  @IsNumber()
  amount!: number

  @ApiProperty({ default: 'INR', required: false })
  @IsOptional()
  @IsString()
  currency?: string
}
