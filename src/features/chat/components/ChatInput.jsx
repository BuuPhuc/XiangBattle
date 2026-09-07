import { useState } from 'react'
import Icon from '../../../components/ui/Icon'
import { MAX_MESSAGE_LENGTH } from '../chatUtils'

export function ChatInput({ onSend }) {
  const [value, setValue] = useState('')

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onSend(trimmed)
    setValue('')
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex items-center gap-2 p-2 border-t border-outline-variant/30 flex-shrink-0">
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
        onKeyDown={handleKeyDown}
        placeholder="Nhập tin nhắn..."
        maxLength={MAX_MESSAGE_LENGTH}
        className="flex-grow min-w-0 px-3 py-2 rounded-lg border border-outline-variant bg-surface-container text-body-sm font-body-sm focus:outline-none focus:border-primary"
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={!value.trim()}
        className="w-9 h-9 flex-shrink-0 rounded-full bg-primary text-on-primary flex items-center justify-center disabled:opacity-40 hover:scale-105 transition-transform"
        aria-label="Gửi tin nhắn"
      >
        <Icon name="send" className="text-[18px]" />
      </button>
    </div>
  )
}

export default ChatInput
