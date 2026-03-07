import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator'

export class CreateReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string

  @ApiPropertyOptional({ description: 'Optional seller target for multi-seller orders' })
  @IsOptional()
  @IsString()
  targetSellerId?: string
}
