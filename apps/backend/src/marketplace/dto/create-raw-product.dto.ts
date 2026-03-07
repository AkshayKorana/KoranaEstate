import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

enum CommodityType {
  COFFEE = 'COFFEE',
  SPICE = 'SPICE',
}

export class CreateRawProductDto {
  @ApiProperty()
  @IsString()
  title!: string

  @ApiProperty({ enum: CommodityType })
  @IsEnum(CommodityType)
  commodityType!: CommodityType

  @ApiProperty()
  @IsString()
  commodityName!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  grade?: string

  @ApiProperty({ minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  quantityKg!: number

  @ApiProperty({ minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  pricePerKg!: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string
}
