import { useEffect, useState } from 'react'
import Icon from '../../../components/ui/Icon'
import { cn } from '../../../components/utils/cn'
import MoveHistoryPanel from './MoveHistoryPanel'
import ChatPanel from '../../../features/chat/components/ChatPanel'

const TABS = { HISTORY: 'history', CHAT: 'chat' }

function TabButton({ active, onClick, icon, label, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex-1 flex items-center justify-center gap-2 py-3 font-label-md text-label-md transition-colors border-b-2',
        active
          ? 'text-primary border-primary bg-surface'
          : 'text-on-surface-variant border-transparent hover:text-on-surface'
      )}
    >
      <Icon name={icon} className="text-[18px]" />
      {label}
      {badge > 0 && (
        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center leading-none">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  )
}

// Single panel used for both Move History and Chat (see the project's chat
// spec: never two side-by-side boxes). `chat` is undefined/null for
// local/offline play (no opponent to chat with), in which case this renders
// exactly what MoveHistoryPanel used to render on its own — same header,
// same card — just with the chrome now living here instead of inside
// MoveHistoryPanel, so online play can reuse it under a tab bar instead.
export function GameHistoryPanel({ moveHistory, currentMoveIndex, onSelectMove, chat }) {
  const [activeTab, setActiveTab] = useState(TABS.HISTORY)

  // Covers both "just switched to the Chat tab" and "already on it and a
  // new message just arrived" — either way, being on the tab means nothing
  // is unread.
  useEffect(() => {
    if (chat && activeTab === TABS.CHAT) chat.markRead()
  }, [chat, activeTab])

  return (
    // Below xl the sidebar is just a stack of natural-height blocks (no
    // stretch to fill against), so this keeps a fixed fallback height there;
    // at xl the sidebar row stretches to match the board column's height,
    // and flex-grow/min-h-0 here is what lets this panel absorb all of the
    // leftover space between the two compact player bars.
    <div className="glass-panel border border-gold-shimmer/30 rounded-xl flex flex-col overflow-hidden h-64 xl:h-auto xl:flex-grow xl:min-h-0">
      {chat ? (
        <div className="flex border-b border-outline-variant/30 bg-surface-container-low rounded-t-xl flex-shrink-0">
          <TabButton active={activeTab === TABS.HISTORY} onClick={() => setActiveTab(TABS.HISTORY)} icon="history" label="Lịch sử" />
          <TabButton
            active={activeTab === TABS.CHAT}
            onClick={() => setActiveTab(TABS.CHAT)}
            icon="chat"
            label="Trò chuyện"
            badge={chat.unreadCount}
          />
        </div>
      ) : (
        <div className="p-4 border-b border-outline-variant/30 bg-surface-container-low rounded-t-xl flex-shrink-0">
          <h4 className="font-label-md text-label-md text-on-surface flex items-center gap-2">
            <Icon name="history" className="text-[18px]" />
            Lịch sử trận đấu
          </h4>
        </div>
      )}

      <div className={cn('flex-grow min-h-0 flex flex-col', chat && activeTab !== TABS.HISTORY && 'hidden')}>
        <MoveHistoryPanel moveHistory={moveHistory} currentMoveIndex={currentMoveIndex} onSelectMove={onSelectMove} />
      </div>

      {chat && (
        <div className={cn('flex-grow min-h-0 flex flex-col', activeTab !== TABS.CHAT && 'hidden')}>
          <ChatPanel messages={chat.messages} sendMessage={chat.sendMessage} />
        </div>
      )}
    </div>
  )
}

export default GameHistoryPanel
