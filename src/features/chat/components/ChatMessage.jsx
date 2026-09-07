import { cn } from '../../../components/utils/cn'

// Opponent bubbles align left with a name label; your own align right and
// skip the name (the side alone already says who it is).
export function ChatMessage({ message }) {
  const { playerName, message: text, mine } = message

  return (
    <div className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
      {!mine && <span className="font-label-sm text-label-sm text-on-surface-variant px-1 mb-0.5">{playerName}</span>}
      <div
        className={cn(
          'max-w-[80%] px-3 py-2 rounded-2xl font-body-sm text-body-sm break-words whitespace-pre-wrap',
          mine ? 'bg-primary text-on-primary rounded-br-sm' : 'bg-surface-container text-on-surface rounded-bl-sm'
        )}
      >
        {text}
      </div>
    </div>
  )
}

export default ChatMessage
