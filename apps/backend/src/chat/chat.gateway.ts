import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { JwtService } from '@nestjs/jwt'
import { Server, Socket } from 'socket.io'

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: [process.env.WEB_ORIGIN ?? 'http://localhost:3000', process.env.MOBILE_ORIGIN ?? 'exp://localhost:8081'],
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server

  private readonly onlineUsers = new Map<string, string>()

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client)
      const payload = this.jwtService.verify<{ sub: string; email: string; role: string }>(token, {
        secret: process.env.ACCESS_JWT_SECRET ?? process.env.JWT_SECRET,
      })
      client.data.user = { userId: payload.sub, email: payload.email, role: payload.role }
      this.onlineUsers.set(payload.sub, client.id)
      this.server.emit('presence:update', { userId: payload.sub, online: true })
    } catch {
      client.disconnect(true)
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.user?.userId as string | undefined
    if (!userId) return
    this.onlineUsers.delete(userId)
    this.server.emit('presence:update', { userId, online: false })
  }

  @SubscribeMessage('conversation:join')
  joinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string },
  ) {
    client.join(`conversation:${body.conversationId}`)
    return { success: true }
  }

  @SubscribeMessage('conversation:typing')
  typing(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string; isTyping: boolean },
  ) {
    const userId = client.data.user?.userId
    this.server.to(`conversation:${body.conversationId}`).emit('conversation:typing', {
      conversationId: body.conversationId,
      userId,
      isTyping: Boolean(body.isTyping),
    })
    return { success: true }
  }

  emitNewMessage(conversationId: string, payload: unknown) {
    this.server.to(`conversation:${conversationId}`).emit('message:new', payload)
  }

  private extractToken(client: Socket) {
    const authHeader = client.handshake.headers.authorization
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length)
    }

    const token = client.handshake.auth?.token
    if (typeof token === 'string' && token.length > 0) return token

    throw new Error('Missing JWT token')
  }
}
