import { IsNumber, IsOptional, IsString, Min } from 'class-validator'
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
}
