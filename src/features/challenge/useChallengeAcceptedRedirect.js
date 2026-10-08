import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import socket from '../../socket/socket'
import { getPlayerId, saveRoomId } from '../room/roomSession'

// The challenger's half of "accept puts both players in the match": they
// could be on any page when their challenge is accepted, so this lives in
// the app shell rather than on the page they sent it from. The server has
// already created the room and seated them (see
// server/sockets/challengeHandler.js) — all that is left is getting this
// tab onto the match screen, which then resumes the room through the same
// rejoin handshake a refresh uses (useRoom).
export function useChallengeAcceptedRedirect(enabled) {
  const navigate = useNavigate()
  const location = useLocation()
  const pathnameRef = useRef(location.pathname)
  useEffect(() => {
    pathnameRef.current = location.pathname
  }, [location.pathname])

  useEffect(() => {
    if (!enabled) return undefined

    function handleAccepted({ roomId, socketId }) {
      saveRoomId(roomId)
      if (pathnameRef.current !== '/room') {
        navigate('/room')
        return
      }
      // Already on the match screen. The tab whose connection the server
      // seated has been handed the match directly (match_found); any other
      // tab of the same account takes the seat over by rejoining.
      if (socket.id !== socketId) socket.emit('rejoin_room', { roomId, playerId: getPlayerId() })
    }

    socket.on('challenge:accepted', handleAccepted)
    return () => socket.off('challenge:accepted', handleAccepted)
  }, [enabled, navigate])
}

export default useChallengeAcceptedRedirect
