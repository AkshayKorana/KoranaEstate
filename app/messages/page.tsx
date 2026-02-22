'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Conversation, Message } from '@/types/marketplace'
import Navbar from '@/app/components/Navbar'
import { useLanguage } from '@/app/language-context'
import { useTheme } from '@/app/theme-context'

export default function MessagesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedConversationId = searchParams.get('conversationId')
  const { lang, t } = useLanguage()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/conversations')
      const data = await res.json()
      const rows: Conversation[] = data.conversations || []
      setConversations(rows)
      if (requestedConversationId) {
        const match = rows.find((row) => row.id === requestedConversationId)
        if (match) setSelectedConversation(match)
      }
      setLoading(false)
    } catch (error) {
      console.error('Failed to fetch conversations:', error)
      setLoading(false)
    }
  }, [requestedConversationId])

  const fetchMessages = useCallback(async () => {
    if (!selectedConversation) return

    try {
      const res = await fetch(`/api/chat/messages?conversationId=${selectedConversation.id}`)
      const data = await res.json()
      setMessages(data.messages || [])
    } catch (error) {
      console.error('Failed to fetch messages:', error)
    }
  }, [selectedConversation])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth')
    } else if (status === 'authenticated') {
      const id = setTimeout(() => {
        void fetchConversations()
      }, 0)
      return () => clearTimeout(id)
    }
  }, [status, router, fetchConversations])

  useEffect(() => {
    if (selectedConversation) {
      const boot = setTimeout(() => {
        void fetchMessages()
      }, 0)
      // Poll for new messages every 5 seconds
      const interval = setInterval(() => {
        void fetchMessages()
      }, 5000)
      return () => {
        clearTimeout(boot)
        clearInterval(interval)
      }
    }
  }, [selectedConversation, fetchMessages])

  useEffect(() => {
    // Auto-scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim() || !selectedConversation) return

    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          content: newMessage
        })
      })

      if (res.ok) {
        setNewMessage('')
        await fetchMessages()
        await fetchConversations() // Refresh to update lastMessageAt
      }
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  function getOtherUser(conversation: Conversation) {
    if (!session?.user?.email) return null
    
    // Find the user by comparing emails
    const currentUserIsBuyer = conversation.buyer?.email === session.user.email
    return currentUserIsBuyer ? conversation.seller : conversation.buyer
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

  if (status === 'loading' || loading) {
    return (
      <div className={`min-h-screen content-under-navbar flex items-center justify-center ${isDark ? 'bg-slate-950' : 'bg-gray-50'}`}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          <p className={`mt-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{t('Loading messages...', 'ಸಂದೇಶಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ...')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen content-under-navbar ${isDark ? 'bg-slate-950' : 'bg-gray-50'}`}>
      <Navbar />
      <div className="h-[calc(100vh-7.5rem)] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className={`h-full rounded-2xl shadow-sm flex overflow-hidden border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-emerald-100'}`}>
          {/* Conversations List */}
          <div className={`w-80 border-r flex flex-col ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
            <div className={`p-4 border-b ${isDark ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-gradient-to-r from-emerald-50 via-white to-blue-50'}`}>
              <h2 className="text-xl font-semibold text-brand-spectrum">{t('Messages', 'ಸಂದೇಶಗಳು')}</h2>
            </div>
            
            <div className={`flex-1 overflow-y-auto ${isDark ? 'bg-slate-800' : 'bg-[#efeae2]'}`}>
              {conversations.length === 0 ? (
                <div className={`p-8 text-center ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                  <p>{t('No conversations yet.', 'ಇನ್ನೂ ಯಾವುದೇ ಸಂಭಾಷಣೆಗಳಿಲ್ಲ.')}</p>
                  <p className="text-sm mt-2">{t('Start chatting with sellers!', 'ಮಾರಾಟಗಾರರೊಂದಿಗೆ ಚಾಟ್ ಪ್ರಾರಂಭಿಸಿ!')}</p>
                </div>
              ) : (
                conversations.map(conversation => {
                  const otherUser = getOtherUser(conversation)
                  const lastMessage = conversation.messages?.[0]
                  
                  return (
                    <button
                      key={conversation.id}
                      onClick={() => setSelectedConversation(conversation)}
                      className={`w-full p-4 border-b text-left transition-colors ${
                        isDark
                          ? `border-slate-700 hover:bg-slate-700 ${selectedConversation?.id === conversation.id ? 'bg-slate-700' : ''}`
                          : `border-gray-100 hover:bg-white/80 ${selectedConversation?.id === conversation.id ? 'bg-white' : ''}`
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-semibold text-lg flex-shrink-0">
                          {otherUser?.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-1">
                            <h3 className={`font-semibold truncate ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{otherUser?.name || t('User', 'ಬಳಕೆದಾರ')}</h3>
                            <span className={`text-xs ml-2 flex-shrink-0 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              {formatDate(conversation.lastMessageAt)}
                            </span>
                          </div>
                          {lastMessage && (
                            <p className={`text-sm truncate ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{lastMessage.content}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 flex flex-col">
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <div className={`p-4 border-b flex items-center gap-3 ${isDark ? 'border-slate-700 bg-slate-900' : 'border-gray-200 bg-white'}`}>
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-semibold">
                    {getOtherUser(selectedConversation)?.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <h3 className={`font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                      {getOtherUser(selectedConversation)?.name || t('User', 'ಬಳಕೆದಾರ')}
                    </h3>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{getOtherUser(selectedConversation)?.email}</p>
                  </div>
                </div>

                {/* Messages */}
                <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${isDark ? 'bg-slate-800' : 'bg-[#e5ddd5]'}`}>
                  {messages.map(message => {
                    const isOwn = message.sender?.email === session?.user?.email
                    
                    return (
                      <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs lg:max-w-md ${isOwn ? 'order-2' : 'order-1'}`}>
                          <div
                            className={`px-4 py-2 rounded-lg ${
                              isOwn
                                ? 'bg-[#dcf8c6] text-gray-900 rounded-br-none'
                                : `${isDark ? 'bg-slate-700 text-gray-100' : 'bg-white text-gray-900'} rounded-bl-none shadow-sm`
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                          </div>
                          <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'} ${isOwn ? 'text-right' : 'text-left'}`}>
                            {formatTime(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input */}
                <form onSubmit={handleSendMessage} className={`p-4 border-t ${isDark ? 'border-slate-700 bg-slate-900' : 'border-gray-200 bg-white'}`}>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={t('Type a message...', 'ಸಂದೇಶವನ್ನು ಟೈಪ್ ಮಾಡಿ...')}
                      className={`flex-1 border rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${isDark ? 'border-slate-600 bg-slate-800 text-gray-100' : 'border-gray-300 bg-white text-gray-900'}`}
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
              <div className={`flex-1 flex items-center justify-center ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                <div className="text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="mt-4 text-lg font-medium">{t('Select a conversation', 'ಒಂದು ಸಂಭಾಷಣೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ')}</p>
                  <p className="text-sm">{t('Choose from your conversations to start messaging', 'ಸಂದೇಶ ಆರಂಭಿಸಲು ನಿಮ್ಮ ಸಂಭಾಷಣೆಗಳಿಂದ ಆಯ್ಕೆಮಾಡಿ')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
