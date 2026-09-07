import { useCallback, useEffect, useState } from 'react'
import socket from '../../../socket/socket'
import { getPlayerId } from '../../room/roomSession'
import { MAX_MESSAGE_LENGTH } from '../chatUtils'

// Tags each server message with whether it's this client's own, so
// ChatPanel/ChatMessage stay purely presentational — the server never sends
// an `isOwn`/`mine` flag itself, it only ever knows playerId.
function tagMine(entry) {
  return { ...entry, mine: entry.playerId === getPlayerId() }
}

// Realtime chat for one online match, wired onto the existing shared socket
// (see useOnlineGame.js for the equivalent move-sync hook) — never opens a
// connection of its own. `initialMessages` seeds the log from the room's
// last server snapshot (game_started/game_state/match_found's `messages`
// array) exactly the way useGame seeds moveHistory: read once at mount, so
// the caller is expected to remount this (same `key` it already changes for
// useGame/useTimer) whenever a fresh restored snapshot comes down.
export function useChat({ enabled, initialMessages }) {
  const [messages, setMessages] = useState(() => (initialMessages ?? []).map(tagMine))
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!enabled) return

    function handleChatMessage(entry) {
      setMessages((current) => [...current, tagMine(entry)])
      setUnreadCount((count) => count + 1)
    }

    socket.on('chat:message', handleChatMessage)
    return () => socket.off('chat:message', handleChatMessage)
  }, [enabled])

  // Server re-trims/re-validates independently (see chatHandler.js) — this
  // only avoids an obviously-empty or oversized round trip.
  const sendMessage = useCallback((text) => {
    const trimmed = text.trim().slice(0, MAX_MESSAGE_LENGTH)
    if (!trimmed) return
    socket.emit('chat:send', { message: trimmed })
  }, [])

  const markRead = useCallback(() => setUnreadCount(0), [])

  return { messages, unreadCount, sendMessage, markRead }
}

export default useChat
