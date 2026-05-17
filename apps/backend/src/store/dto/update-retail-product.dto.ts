import { IsNumber, IsOptional, IsString, Min, Max } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateRetailProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string

  @ApiPropertyOptional({ minimum: 0.01 })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  price?: number

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coffeeVariant?: string

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  coffeeVariantPct?: number

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  chicoryPct?: number
}
