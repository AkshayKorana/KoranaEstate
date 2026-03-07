/**
 * Mobile subscribes to server-issued channel metadata or websocket gateway later.
 * Supabase Realtime is intentionally not called directly from frontend per architecture rule.
 */
export function subscribeToConversation(_conversationId: string) {
  return () => {
    // no-op placeholder for backend-proxied realtime strategy
  }
}
