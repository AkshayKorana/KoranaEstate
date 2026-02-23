import { ApiProperty } from '@nestjs/swagger'
import { IsDateString, IsEnum } from 'class-validator'

enum PlanType {
  FREE = 'FREE',
  PRO = 'PRO',
}

enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export class UpsertSubscriptionDto {
  @ApiProperty({ enum: PlanType })
  @IsEnum(PlanType)
  planType!: PlanType

  @ApiProperty({ enum: SubscriptionStatus })
  @IsEnum(SubscriptionStatus)
  status!: SubscriptionStatus

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  startDate!: string

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  endDate!: string
}
