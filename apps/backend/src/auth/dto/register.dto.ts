import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

enum RegisterRole {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
  WORKER = 'WORKER',
}

export class RegisterDto {
  @ApiProperty()
  @IsString()
  fullName!: string

  @ApiProperty()
  @IsEmail()
  email!: string

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string

  @ApiPropertyOptional({ enum: RegisterRole })
  @IsOptional()
  @IsEnum(RegisterRole)
  role?: RegisterRole
}
