import { Type } from 'class-transformer'
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator'
import { OrderCustomerDetailsDto } from './order-customer-details.dto'

export class CreateOrderItemDto {
  @IsString()
  productId!: string

  @IsInt()
  @Min(1)
  quantity!: number
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[]

  @IsOptional()
  @ValidateNested()
  @Type(() => OrderCustomerDetailsDto)
  customer?: OrderCustomerDetailsDto
}
