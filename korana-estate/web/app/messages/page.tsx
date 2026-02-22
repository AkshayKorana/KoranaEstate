'use client'

import { useEffect, useState } from 'react'
import { chatService } from '../../src/services/chat.service'

export default function MessagesPage() {
  const [conversations, setConversations] = useState<unknown[]>([])

  useEffect(() => {
    chatService.conversations().then((d) => setConversations(d as unknown[])).catch(() => setConversations([]))
  }, [])

  return (
    <main style={{ maxWidth: 960, margin: '40px auto', padding: 24 }}>
      <h1>Messages</h1>
      <pre>{JSON.stringify(conversations, null, 2)}</pre>
    </main>
  )
}
