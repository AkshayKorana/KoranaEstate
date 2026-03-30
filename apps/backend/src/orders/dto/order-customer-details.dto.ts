import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, Matches } from 'class-validator'

export class OrderCustomerDetailsDto {
  @ApiProperty()
  @IsString()
  fullName!: string

  @ApiProperty({ description: '10-digit Indian mobile number' })
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'mobileNumber must be a valid 10-digit Indian mobile number' })
  mobileNumber!: string

  @ApiProperty()
  @IsString()
  addressLine1!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLine2?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  area?: string

  @ApiProperty()
  @IsString()
  city!: string

  @ApiProperty()
  @IsString()
  state!: string

  @ApiProperty({ description: '6-digit Indian pincode' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'pincode must be a valid 6-digit pincode' })
  pincode!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  landmark?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderNote?: string
}
