import { IsOptional, IsString } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullName?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string
}
