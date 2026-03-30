'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Conversation, Message } from '@/types/marketplace'
import { useLanguage } from '@/app/language-context'
import { useEffectiveTheme } from '@/app/theme-context'
import { handleSessionExpired, readResponsePayload, toChatApiError } from '@/app/lib/chat-client'

export default function MessagesClient() {
  const router = useRouter()
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated: () => router.replace('/auth'),
  })
  const searchParams = useSearchParams()
  const requestedConversationId = searchParams.get('conversationId')
  const { lang, t } = useLanguage()
  const { isDark } = useEffectiveTheme()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [conversationError, setConversationError] = useState('')
  const [messagesError, setMessagesError] = useState('')
  const [conversationNotFound, setConversationNotFound] = useState(false)
  const [isPageVisible, setIsPageVisible] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const optimisticIdRef = useRef(0)

  const fetchConversations = useCallback(async (signal?: AbortSignal) => {
    try {
      setConversationError('')
      const res = await fetch('/api/chat/conversations', {
        cache: 'no-store',
        signal,
      })
      const payload = await readResponsePayload<Conversation[] | { conversations?: Conversation[] }>(res)
      if (!res.ok) {
        const error = toChatApiError(res, payload)
        console.error('Chat conversations failed', error.status, error.message)
        if (await handleSessionExpired(error)) {
          return
        }
        throw new Error(error.message)
      }

      const data = payload.data
      const rows: Conversation[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.conversations)
          ? (data.conversations ?? [])
          : []

      setConversations(rows)
      const requestedMatch = requestedConversationId
        ? rows.find((row) => row.id === requestedConversationId) ?? null
        : null
      setConversationNotFound(Boolean(requestedConversationId) && !requestedMatch)
      setSelectedConversation((current) => {
        if (requestedConversationId) {
          return requestedMatch
        }

        if (current) {
          return rows.find((row) => row.id === current.id) ?? null
        }

        return rows[0] ?? null
      })
      setLoading(false)
    } catch (error) {
      if (signal?.aborted) {
        return
      }
      console.error('Failed to fetch conversations:', error)
      setConversationError(
        t('Unable to load conversations right now.', 'ಈಗ ಸಂಭಾಷಣೆಗಳನ್ನು ಲೋಡ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.')
      )
      setLoading(false)
    }
  }, [requestedConversationId, t])

  const fetchMessages = useCallback(async (conversationId: string, signal?: AbortSignal) => {
    if (!conversationId) return

    try {
      setMessagesError('')
      setMessagesLoading(true)
      const res = await fetch(`/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}`, {
        cache: 'no-store',
        signal,
      })
      const payload = await readResponsePayload<Message[] | { messages?: Message[] }>(res)
      if (!res.ok) {
        const error = toChatApiError(res, payload)
        console.error('Chat messages failed', error.status, error.message)
        if (await handleSessionExpired(error)) {
          return
        }
        throw new Error(error.message)
      }

      const data = payload.data
      const rows: Message[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.messages)
          ? (data.messages ?? [])
          : []

      setMessages(rows)
    } catch (error) {
      if (signal?.aborted) {
        return
      }
      console.error('Failed to fetch messages:', error)
      setMessagesError(
        t('Unable to load messages right now.', 'ಈಗ ಸಂದೇಶಗಳನ್ನು ಲೋಡ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.')
      )
    } finally {
      if (!signal?.aborted) {
        setMessagesLoading(false)
      }
    }
  }, [t])

  useEffect(() => {
    if (status !== 'authenticated') return
    const controller = new AbortController()
    void fetchConversations(controller.signal)
    return () => controller.abort()
  }, [status, fetchConversations])

  useEffect(() => {
    if (status !== 'authenticated' || !selectedConversation) return
    const controller = new AbortController()
    void fetchMessages(selectedConversation.id, controller.signal)
    return () => controller.abort()
  }, [status, selectedConversation, fetchMessages])

  useEffect(() => {
    if (typeof document === 'undefined') return

    const updateVisibility = () => setIsPageVisible(document.visibilityState === 'visible')
    updateVisibility()
    document.addEventListener('visibilitychange', updateVisibility)

    return () => {
      document.removeEventListener('visibilitychange', updateVisibility)
    }
  }, [])

  useEffect(() => {
    if (status !== 'authenticated' || !selectedConversation || !isPageVisible) return
    const interval = setInterval(() => {
      void fetchMessages(selectedConversation.id)
    }, 5000)
    return () => {
      clearInterval(interval)
    }
  }, [status, selectedConversation, isPageVisible, fetchMessages])

  useEffect(() => {
    if (!selectedConversation) return
    const nextUrl = `/messages?conversationId=${encodeURIComponent(selectedConversation.id)}`
    if (requestedConversationId !== selectedConversation.id) {
      router.replace(nextUrl)
    }
  }, [selectedConversation, requestedConversationId, router])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim() || !selectedConversation) return

    const optimisticContent = newMessage.trim()
    const optimisticId = `temp-${selectedConversation.id}-${optimisticIdRef.current++}`
    const optimisticMessage: Message = {
      id: optimisticId,
      conversationId: selectedConversation.id,
      senderId: session?.user?.id || 'me',
      content: optimisticContent,
      isRead: true,
      createdAt: new Date().toISOString(),
    }

    setMessages((current) => [...current, optimisticMessage])
    setNewMessage('')
    setMessagesError('')

    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          content: optimisticContent,
        }),
      })

      const payload = await readResponsePayload<Message>(res)
      if (!res.ok) {
        setMessages((current) => current.filter((message) => message.id !== optimisticId))
        const error = toChatApiError(res, payload)
        console.error('Send message failed', error.status, error.message)
        if (await handleSessionExpired(error)) {
          return
        }
        setMessagesError(error.message || t('Failed to send message.', 'ಸಂದೇಶವನ್ನು ಕಳುಹಿಸಲು ವಿಫಲವಾಗಿದೆ.'))
        return
      }
      if (payload.data?.id) {
        setMessages((current) =>
          current.map((message) => (message.id === optimisticId ? payload.data! : message))
        )
      }
      await fetchConversations()
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== optimisticId))
      console.error('Error sending message:', error)
      setMessagesError(t('Failed to send message.', 'ಸಂದೇಶವನ್ನು ಕಳುಹಿಸಲು ವಿಫಲವಾಗಿದೆ.'))
    }
  }

  function getOtherParticipant(conversation: Conversation) {
    const currentUserId = session?.user?.id
    return conversation.participants?.find((participant) => participant.user?.id !== currentUserId) ?? null
  }

  function formatTime(date: string | Date) {
    const d = new Date(date)
    return d.toLocaleTimeString(lang === 'kn' ? 'kn-IN' : 'en-US', { hour: '2-digit', minute: '2-digit' })
  }

  function formatDate(date: string | Date) {
    const d = new Date(date)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (d.toDateString() === today.toDateString()) return t('Today', 'ಇಂದು')
    if (d.toDateString() === yesterday.toDateString()) return t('Yesterday', 'ನಿನ್ನೆ')
    return d.toLocaleDateString(lang === 'kn' ? 'kn-IN' : 'en-US', { month: 'short', day: 'numeric' })
  }

  function getParticipantLabel(conversation: Conversation) {
    return getOtherParticipant(conversation)?.user?.fullName || t('User', 'ಬಳಕೆದಾರ')
  }

  if (status === 'loading' || loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-slate-950' : 'bg-transparent'}`}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          <p className="mt-2 text-muted-safe">{t('Loading messages...', 'ಸಂದೇಶಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ...')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950' : 'bg-transparent'}`}>
      <div className="h-[calc(100vh-10rem)] max-w-7xl mx-auto px-6 md:px-8 lg:px-10 py-6">
        <div className="surface-panel h-full rounded-3xl shadow-sm flex overflow-hidden">
          <div className="w-80 border-r border-black/10 dark:border-white/10 flex flex-col">
            <div className="surface-card-strong p-4 border-b border-black/10 dark:border-white/10">
              <h2 className="font-luxe text-2xl font-semibold text-card-strong">{t('Messages', 'ಸಂದೇಶಗಳು')}</h2>
            </div>

            <div className="flex-1 overflow-y-auto">
              {conversationError && (
                <div className="m-4 rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
                  <p>{conversationError}</p>
                  <button
                    type="button"
                    onClick={() => void fetchConversations()}
                    className="mt-2 rounded-lg border border-red-300/40 px-3 py-1 font-semibold text-red-100"
                  >
                    {t('Retry', 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ')}
                  </button>
                </div>
              )}
              {conversationNotFound && (
                <div className="m-4 rounded-xl border border-amber-300/40 bg-amber-500/10 p-3 text-sm text-amber-100">
                  {t('Conversation not found.', 'ಸಂಭಾಷಣೆ ಕಂಡುಬಂದಿಲ್ಲ.')}
                </div>
              )}
              {conversations.length === 0 ? (
                <div className="p-8 text-center text-card-strong">
                  <p>{t('No conversations yet.', 'ಇನ್ನೂ ಯಾವುದೇ ಸಂಭಾಷಣೆಗಳಿಲ್ಲ.')}</p>
                  <p className="text-sm mt-2 text-muted-safe">
                    {t('Start chatting with sellers!', 'ಮಾರಾಟಗಾರರೊಂದಿಗೆ ಚಾಟ್ ಪ್ರಾರಂಭಿಸಿ!')}
                  </p>
                </div>
              ) : (
                conversations.map((conversation) => {
                  const lastMessage = conversation.messages?.[0]

                  return (
                    <button
                      key={conversation.id}
                      onClick={() => {
                        setConversationNotFound(false)
                        setSelectedConversation(conversation)
                      }}
                      className={`w-full p-4 border-b text-left transition-all duration-300 ${
                        isDark
                          ? `border-white/10 hover:bg-white/5 ${selectedConversation?.id === conversation.id ? 'bg-white/8' : ''}`
                          : `border-black/10 hover:bg-black/3 ${selectedConversation?.id === conversation.id ? 'bg-black/4' : ''}`
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-semibold text-lg flex-shrink-0">
                          {getParticipantLabel(conversation)[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-1">
                            <h3 className="font-semibold truncate text-card-strong">{getParticipantLabel(conversation)}</h3>
                            <span className="text-xs ml-2 flex-shrink-0 text-muted-safe">
                              {formatDate(conversation.lastMessageAt)}
                            </span>
                          </div>
                          {lastMessage && (
                            <p className="text-sm truncate text-muted-safe">{lastMessage.content}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            {selectedConversation ? (
              <>
                <div className="surface-card-strong p-4 border-b border-black/10 dark:border-white/10 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-semibold">
                    {getParticipantLabel(selectedConversation)[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <h3 className="font-semibold text-card-strong">
                      {getParticipantLabel(selectedConversation)}
                    </h3>
                    <p className="text-xs text-muted-safe">
                      {getOtherParticipant(selectedConversation)?.user?.role || ''}
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messagesError && (
                    <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">
                      <p>{messagesError}</p>
                      <button
                        type="button"
                        onClick={() => void fetchMessages(selectedConversation.id)}
                        className="mt-2 rounded-lg border border-red-300/40 px-3 py-1 font-semibold text-red-100"
                      >
                        {t('Retry', 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ')}
                      </button>
                    </div>
                  )}
                  {messagesLoading && (
                    <div className="surface-card rounded-xl p-3 text-sm text-muted-safe">
                      {t('Loading messages...', 'ಸಂದೇಶಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ...')}
                    </div>
                  )}
                  {!messagesLoading && !messagesError && messages.length === 0 && (
                    <div className="surface-card rounded-xl p-3 text-sm text-muted-safe">
                      {t('No messages yet. Start the conversation.', 'ಇನ್ನೂ ಯಾವುದೇ ಸಂದೇಶಗಳಿಲ್ಲ. ಸಂಭಾಷಣೆಯನ್ನು ಪ್ರಾರಂಭಿಸಿ.')}
                    </div>
                  )}
                  {messages.map((message, idx) => {
                    const isOwn = message.senderId === session?.user?.id

                    return (
                      <div
                        key={message.id}
                        className={`fade-in flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                        style={{ animationDelay: `${Math.min(idx * 25, 220)}ms` }}
                      >
                        <div className={`max-w-xs lg:max-w-md ${isOwn ? 'order-2' : 'order-1'}`}>
                          <div
                            className={`px-4 py-2 rounded-lg ${
                              isOwn
                                ? 'chat-bubble-own rounded-br-none shadow-lg'
                                : 'surface-card rounded-bl-none shadow-sm'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                          </div>
                          <p className={`text-xs mt-1 text-muted-safe ${isOwn ? 'text-right' : 'text-left'}`}>
                            {formatTime(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSendMessage} className="surface-card-strong p-4 border-t border-black/10 dark:border-white/10">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={t('Type a message...', 'ಸಂದೇಶವನ್ನು ಟೈಪ್ ಮಾಡಿ...')}
                      className="surface-input flex-1 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="gradient-brand-spectrum text-white px-6 py-2 rounded-full hover:opacity-95 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
                    >
                      {t('Send', 'ಕಳುಹಿಸಿ')}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-safe">
                <div className="text-center">
                  <svg className="mx-auto h-12 w-12 text-subtle-safe" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="mt-4 text-lg font-medium text-card-strong">{t('Select a conversation', 'ಒಂದು ಸಂಭಾಷಣೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ')}</p>
                  <p className="text-sm text-muted-safe">{t('Choose from your conversations to start messaging', 'ಸಂದೇಶ ಆರಂಭಿಸಲು ನಿಮ್ಮ ಸಂಭಾಷಣೆಗಳಿಂದ ಆಯ್ಕೆಮಾಡಿ')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
