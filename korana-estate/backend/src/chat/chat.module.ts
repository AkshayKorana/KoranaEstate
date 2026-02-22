import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { SupabaseService } from '../config/supabase.service'
import { RolesGuard } from '../common/guards/roles.guard'
import { ChatController } from './chat.controller'
import { ChatGateway } from './chat.gateway'
import { ChatService } from './chat.service'
import { ChatRealtimeService } from './realtime.service'

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.ACCESS_JWT_SECRET ?? process.env.JWT_SECRET,
    }),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatRealtimeService, ChatGateway, RolesGuard, SupabaseService],
  exports: [ChatGateway],
})
export class ChatModule {}
