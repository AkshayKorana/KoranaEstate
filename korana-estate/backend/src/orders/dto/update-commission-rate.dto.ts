import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, Max, Min } from 'class-validator'

export class UpdateCommissionRateDto {
  @ApiProperty({ minimum: 0, maximum: 1, example: 0.05 })
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionRate!: number
}
