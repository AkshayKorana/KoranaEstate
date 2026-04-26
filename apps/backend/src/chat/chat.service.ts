import { ForbiddenException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ChatGateway } from './chat.gateway'
import { CreateConversationDto } from './dto/create-conversation.dto'
import { SendMessageDto } from './dto/send-message.dto'

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
  ) {}

  async myConversations(userId: string) {
    try {
      return await this.prisma.conversation.findMany({
        where: { participants: { some: { userId } } },
        include: {
          participants: { include: { user: { select: { id: true, fullName: true, role: true, email: true } } } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { updatedAt: 'desc' },
      })
    } catch (error) {
      this.logger.error('myConversations failed', error instanceof Error ? error.stack : String(error))
      throw new InternalServerErrorException('Failed to load conversations')
    }
  }

  async createConversation(userId: string, dto: CreateConversationDto) {
    const participant = await this.prisma.user.findUnique({ where: { id: dto.participantId } })
    if (!participant) throw new NotFoundException('Participant user not found')
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
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: dto.conversationId },
      include: { participants: { select: { userId: true } } },
    })
    if (!conversation) throw new NotFoundException('Conversation not found')
    if (!conversation.participants.some((p) => p.userId === userId)) {
      throw new ForbiddenException('You are not a participant in this conversation')
    }
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

  async listMessages(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: { select: { userId: true } } },
    })
    if (!conversation) throw new NotFoundException('Conversation not found')
    if (!conversation.participants.some((p) => p.userId === userId)) {
      throw new ForbiddenException('You are not a participant in this conversation')
    }
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    })
  }
}
