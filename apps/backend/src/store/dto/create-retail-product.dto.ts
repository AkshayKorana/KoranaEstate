import { IsNumber, IsOptional, IsString, Min, Max } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateRetailProductDto {
  @ApiProperty()
  @IsString()
  title!: string

  @ApiProperty()
  @IsString()
  category!: string

  @ApiProperty({ minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  price!: number

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  stock!: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string

  @ApiPropertyOptional({ description: 'Coffee variant e.g. Arabica Cherry' })
  @IsOptional()
  @IsString()
  coffeeVariant?: string

  @ApiPropertyOptional({ description: 'Coffee variant percentage 0-100', minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  coffeeVariantPct?: number

  @ApiPropertyOptional({ description: 'Chicory percentage 0-100', minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  chicoryPct?: number
}
