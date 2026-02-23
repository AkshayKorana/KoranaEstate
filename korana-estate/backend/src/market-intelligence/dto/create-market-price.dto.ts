import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateMarketPriceDto {
  @ApiProperty()
  @IsString()
  commodityName!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  market?: string

  @ApiProperty({ minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  priceInrPerKg!: number

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  observedAt!: string
}
