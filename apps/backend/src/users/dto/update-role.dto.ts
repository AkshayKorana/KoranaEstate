import { IsEnum } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

enum Role {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
  WORKER = 'WORKER',
  ADMIN = 'ADMIN',
}

export class UpdateRoleDto {
  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role!: Role
}
