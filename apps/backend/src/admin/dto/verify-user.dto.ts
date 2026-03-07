import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean, IsEnum } from 'class-validator'

enum VerificationLevel {
  NONE = 'NONE',
  BASIC = 'BASIC',
  TRUSTED = 'TRUSTED',
  PREMIUM = 'PREMIUM',
}

export class VerifyUserDto {
  @ApiProperty()
  @IsBoolean()
  verified!: boolean

  @ApiProperty({ enum: VerificationLevel })
  @IsEnum(VerificationLevel)
  verificationLevel!: VerificationLevel
}
