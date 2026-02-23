import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ChatGateway } from './chat.gateway'
import { CreateConversationDto } from './dto/create-conversation.dto'
import { SendMessageDto } from './dto/send-message.dto'

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
  ) {}

  myConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: { participants: { some: { userId } } },
      include: {
        participants: { include: { user: { select: { id: true, fullName: true, role: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async createConversation(userId: string, dto: CreateConversationDto) {
    return this.prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId }, { userId: dto.participantId }],
        },
      },
      include: { participants: true },
    })
  }

  async sendMessage(userId: string, dto: SendMessageDto) {
    const message = await this.prisma.message.create({
      data: {
        conversationId: dto.conversationId,
        senderId: userId,
        content: dto.content,
      },
    })

    await this.prisma.conversation.update({ where: { id: dto.conversationId }, data: { updatedAt: new Date() } })
    this.chatGateway.emitNewMessage(dto.conversationId, message)
    return message
  }

  listMessages(conversationId: string) {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    })
  }
}
