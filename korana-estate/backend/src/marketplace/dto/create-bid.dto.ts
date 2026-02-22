import { IsNumber, IsOptional, IsString, Min } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateBidDto {
  @ApiProperty({ minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  amountPerKg!: number

  @ApiProperty({ minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  quantityKg!: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string
}
