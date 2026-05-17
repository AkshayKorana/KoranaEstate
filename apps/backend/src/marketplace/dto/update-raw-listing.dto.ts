import { IsNumber, IsOptional, IsString, Min } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateRawListingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  commodityName?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  grade?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string

  @ApiPropertyOptional({ minimum: 0.01 })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  quantityKg?: number

  @ApiPropertyOptional({ minimum: 0.01 })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  pricePerKg?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string
}
