import { ApiProperty } from '@nestjs/swagger'

export class AuthUserDto {
  @ApiProperty()
  id!: string

  @ApiProperty()
  email!: string

  @ApiProperty()
  fullName!: string

  @ApiProperty({ enum: ['BUYER', 'SELLER', 'WORKER', 'ADMIN'] })
  role!: string
}

export class AuthResponseDto {
  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto

  @ApiProperty()
  accessToken!: string

  @ApiProperty()
  refreshToken!: string
}
