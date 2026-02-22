import { apiRequest } from './api-client'

export const chatService = {
  conversations: () => apiRequest('/chat/conversations'),
  createConversation: (payload: unknown) => apiRequest('/chat/conversations', 'POST', payload),
  messages: (conversationId: string) => apiRequest(`/chat/conversations/${conversationId}/messages`),
  sendMessage: (payload: unknown) => apiRequest('/chat/messages', 'POST', payload),
}
