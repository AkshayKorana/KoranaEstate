import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsString, Min, ValidateNested } from 'class-validator'
import { OrderCustomerDetailsDto } from './order-customer-details.dto'

export class CreateRawMarketplaceOrderDto {
  @ApiProperty()
  @IsString()
  rawProductId!: string

  @ApiProperty({ minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  quantityKg!: number

  @ApiProperty({ type: OrderCustomerDetailsDto })
  @ValidateNested()
  @Type(() => OrderCustomerDetailsDto)
  customer!: OrderCustomerDetailsDto
}
