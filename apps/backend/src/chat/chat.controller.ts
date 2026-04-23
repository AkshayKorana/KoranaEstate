import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { ChatService } from './chat.service'
import { CreateConversationDto } from './dto/create-conversation.dto'
import { SendMessageDto } from './dto/send-message.dto'

@Controller({ path: 'chat', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('chat')
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'List user conversations' })
  @ApiOkResponse({ description: 'Conversations retrieved' })
  conversations(@Req() req: { user: { userId: string } }) {
    return this.chatService.myConversations(req.user.userId)
  }

  @Post('conversations')
  @ApiOperation({ summary: 'Create conversation' })
  @ApiOkResponse({ description: 'Conversation created' })
  createConversation(@Req() req: { user: { userId: string } }, @Body() dto: CreateConversationDto) {
    return this.chatService.createConversation(req.user.userId, dto)
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'List messages in a conversation' })
  @ApiOkResponse({ description: 'Messages retrieved' })
  messages(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.chatService.listMessages(id, req.user.userId)
  }

  @Post('messages')
  @ApiOperation({ summary: 'Send message' })
  @ApiOkResponse({ description: 'Message sent' })
  send(@Req() req: { user: { userId: string } }, @Body() dto: SendMessageDto) {
    return this.chatService.sendMessage(req.user.userId, dto)
  }
}
