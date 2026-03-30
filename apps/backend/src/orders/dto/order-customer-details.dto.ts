import { Matches, IsOptional, IsString } from 'class-validator'

export class OrderCustomerDetailsDto {
  @IsString()
  fullName!: string

  @Matches(/^[6-9]\d{9}$/, { message: 'mobileNumber must be a valid 10-digit Indian mobile number' })
  mobileNumber!: string

  @IsString()
  addressLine1!: string

  @IsOptional()
  @IsString()
  addressLine2?: string

  @IsOptional()
  @IsString()
  area?: string

  @IsString()
  city!: string

  @IsString()
  state!: string

  @Matches(/^\d{6}$/, { message: 'pincode must be a valid 6-digit pincode' })
  pincode!: string

  @IsOptional()
  @IsString()
  landmark?: string

  @IsOptional()
  @IsString()
  orderNote?: string
}
