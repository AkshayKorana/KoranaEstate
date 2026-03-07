import { ApiProperty } from '@nestjs/swagger'
import { IsString, MinLength } from 'class-validator'

export class HoldPayoutDto {
  @ApiProperty({ minLength: 3 })
  @IsString()
  @MinLength(3)
  holdReason!: string
}
