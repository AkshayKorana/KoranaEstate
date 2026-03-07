import { IsArray, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

class CreateOrderItemDto {
  @ApiProperty()
  @IsString()
  retailProductId!: string

  @ApiProperty({ minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity!: number

  @ApiProperty({ minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  unitPrice!: number
}

export class CreateOrderDto {
  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shippingAddress?: string
}
