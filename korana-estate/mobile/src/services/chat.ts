import { request } from './api'

export const chatApi = {
  conversations: () => request('/chat/conversations'),
  messages: (conversationId: string) => request(`/chat/conversations/${conversationId}/messages`),
  send: (payload: { conversationId: string; content: string }) => request('/chat/messages', 'POST', payload),
}
