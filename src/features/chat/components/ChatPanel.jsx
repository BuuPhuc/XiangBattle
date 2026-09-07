import { useEffect, useRef } from 'react'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'

// Under this many px from the bottom counts as "already at the latest
// message" — close enough that a new arrival should still auto-scroll.
const NEAR_BOTTOM_THRESHOLD_PX = 80

// Content of the Chat tab in GameHistoryPanel: scrollable message list plus
// the input, always pinned at the bottom. Auto-scrolls to the newest
// message only when the user was already near the bottom — someone
// scrolled up to reread earlier messages is left alone.
export function ChatPanel({ messages, sendMessage }) {
  const scrollRef = useRef(null)
  const wasNearBottomRef = useRef(true)

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    wasNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_THRESHOLD_PX
  }

  useEffect(() => {
    const el = scrollRef.current
    if (el && wasNearBottomRef.current) el.scrollTop = el.scrollHeight
  }, [messages])

  return (
    <div className="flex flex-col flex-grow min-h-0">
      {messages.length === 0 ? (
        <div className="flex-grow flex items-center justify-center p-4">
          <p className="font-label-sm text-label-sm text-on-surface-variant text-center">Chưa có tin nhắn nào</p>
        </div>
      ) : (
        <div ref={scrollRef} onScroll={handleScroll} className="flex-grow overflow-y-auto p-3 space-y-2">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
        </div>
      )}
      <ChatInput onSend={sendMessage} />
    </div>
  )
}

export default ChatPanel
