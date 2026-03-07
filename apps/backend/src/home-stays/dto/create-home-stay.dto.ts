import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator'

export class CreateHomeStayDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description!: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  location!: string

  @ApiProperty({ minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  pricePerNight!: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string
}
