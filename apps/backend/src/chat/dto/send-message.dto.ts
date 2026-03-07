import { IsString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class SendMessageDto {
  @ApiProperty()
  @IsString()
  conversationId!: string

  @ApiProperty()
  @IsString()
  content!: string
}
