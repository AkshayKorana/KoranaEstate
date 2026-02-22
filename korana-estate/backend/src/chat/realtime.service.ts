import { Injectable } from '@nestjs/common'
import { SupabaseService } from '../config/supabase.service'

@Injectable()
export class ChatRealtimeService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Placeholder for backend-side Supabase Realtime bridge.
   * In production, connect once here with service-role access, then publish events
   * to websocket clients (web/mobile) without exposing Supabase directly to frontend.
   */
  publishMessageEvent(conversationId: string, messageId: string) {
    return {
      conversationId,
      messageId,
      channel: `chat:${conversationId}`,
      provider: this.supabase.url,
    }
  }
}
