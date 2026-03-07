import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsString } from 'class-validator'

enum Provider {
  RAZORPAY = 'RAZORPAY',
  STRIPE = 'STRIPE',
}

export class CreatePaymentDto {
  @ApiProperty({ enum: Provider })
  @IsEnum(Provider)
  provider!: Provider

  @ApiProperty()
  @IsString()
  orderId!: string
}
