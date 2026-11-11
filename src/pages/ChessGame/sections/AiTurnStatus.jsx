import Icon from '../../../components/ui/Icon'

// Whose turn it is in a game against the bot. Always rendered during play
// (same pill shape as MatchStatus) so the board doesn't jump each turn.
export function AiTurnStatus({ thinking, botName }) {
  return (
    <div
      className="mb-3 px-6 py-2 glass-panel border border-gold-shimmer/30 rounded-full flex items-center gap-3"
      role="status"
      aria-live="polite"
    >
      {thinking ? (
        <>
          <span className="flex gap-1" aria-hidden="true">
            <span className="w-2 h-2 rounded-full bg-secondary animate-bounce [animation-delay:-0.3s]" />
            <span className="w-2 h-2 rounded-full bg-secondary animate-bounce [animation-delay:-0.15s]" />
            <span className="w-2 h-2 rounded-full bg-secondary animate-bounce" />
          </span>
          <span className="font-label-md text-label-md text-on-surface-variant">{botName} đang suy nghĩ...</span>
        </>
      ) : (
        <>
          <Icon name="touch_app" className="text-[18px] text-primary" />
          <span className="font-label-md text-label-md text-primary">Đến lượt bạn</span>
        </>
      )}
    </div>
  )
}

export default AiTurnStatus
