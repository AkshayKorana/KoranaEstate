import { Type } from 'class-transformer'
import { IsNumber, IsString, Min, ValidateNested } from 'class-validator'
import { OrderCustomerDetailsDto } from './order-customer-details.dto'

export class CreateRawMarketplaceOrderDto {
  @IsString()
  rawProductId!: string

  @IsNumber()
  @Min(0.01)
  quantityKg!: number

  @ValidateNested()
  @Type(() => OrderCustomerDetailsDto)
  customer!: OrderCustomerDetailsDto
}
