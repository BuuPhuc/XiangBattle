import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import socket from '../../socket/socket'
import useAuth from '../../components/hooks/useAuth'
import challengeService, { isDeadChallengeCode } from '../../services/challengeService'
import { saveRoomId } from '../room/roomSession'

function errorData(err) {
  return (err.response && err.response.data) || {}
}

function withEntry(map, userId, challengeId) {
  return { ...map, [userId]: challengeId }
}

function withoutEntry(map, userId) {
  if (!(userId in map)) return map
  const next = { ...map }
  delete next[userId]
  return next
}

// The current user's open challenges, shaped for drawing a Thách đấu button
// next to any other player (Friends list, Public Profile): which of them I
// have challenged, which have challenged me, and the four actions.
//
// Everything here is a display aid. The lists come from the server on mount
// and on every socket (re)connect, and 'challenge:updated' (the app's one
// shared socket — nothing here opens a connection) keeps them current in
// between; whether an action is actually allowed is decided by the server
// when it is taken, and its answer overrides whatever was drawn.
export function useChallenges() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()
  const myId = user ? user.id : null

  const [sent, setSent] = useState({}) // other player's id -> challenge id
  const [received, setReceived] = useState({}) // other player's id -> challenge id
  const [accepted, setAccepted] = useState(() => new Set()) // players whose match is starting
  const [blocked, setBlocked] = useState(() => new Set()) // players the server said cannot be challenged
  const [busyIds, setBusyIds] = useState(() => new Set())
  // Latest outcome worth telling the user about: { userId, tone, text }.
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    if (!isAuthenticated || myId == null) return undefined
    let cancelled = false

    function load() {
      challengeService
        .getPending()
        .then((data) => {
          if (cancelled) return
          setSent(Object.fromEntries((data.sent || []).map((entry) => [entry.userId, entry.id])))
          setReceived(Object.fromEntries((data.received || []).map((entry) => [entry.userId, entry.id])))
        })
        .catch(() => {
          // Buttons fall back to "Thách đấu"; the server still refuses a
          // duplicate and says so.
        })
    }

    function handleUpdated({ challengeId, status, senderId, receiverId }) {
      const iAmSender = senderId === myId
      const otherId = iAmSender ? receiverId : senderId
      const setMap = iAmSender ? setSent : setReceived

      if (status === 'PENDING') {
        setMap((current) => withEntry(current, otherId, challengeId))
        return
      }
      setMap((current) => (current[otherId] === challengeId ? withoutEntry(current, otherId) : current))
      if (status === 'ACCEPTED') {
        setAccepted((current) => new Set(current).add(otherId))
      } else if (iAmSender && status === 'REJECTED') {
        setFeedback({ userId: otherId, tone: 'info', text: 'Lời mời thách đấu của bạn đã bị từ chối.' })
      }
    }

    load()
    socket.on('connect', load)
    socket.on('challenge:updated', handleUpdated)
    return () => {
      cancelled = true
      socket.off('connect', load)
      socket.off('challenge:updated', handleUpdated)
    }
  }, [isAuthenticated, myId])

  const setBusy = useCallback((userId, isBusy) => {
    setBusyIds((current) => {
      const next = new Set(current)
      if (isBusy) next.add(userId)
      else next.delete(userId)
      return next
    })
  }, [])

  const challenge = useCallback(
    async (userId) => {
      setFeedback(null)
      setBusy(userId, true)
      try {
        const data = await challengeService.send(userId)
        setSent((current) => withEntry(current, userId, data.challenge.id))
        setFeedback({ userId, tone: 'info', text: 'Đã gửi lời mời thách đấu.' })
      } catch (err) {
        const { code, message, challengeId } = errorData(err)
        if (code === 'CHALLENGE_ALREADY_SENT' && challengeId) {
          setSent((current) => withEntry(current, userId, challengeId))
          setFeedback({ userId, tone: 'info', text: message })
        } else if (code === 'CHALLENGE_INCOMING_PENDING' && challengeId) {
          // They challenged me first — show their invite to accept instead.
          setReceived((current) => withEntry(current, userId, challengeId))
          setFeedback({ userId, tone: 'info', text: message })
        } else {
          if (code === 'CHALLENGE_NOT_ALLOWED') setBlocked((current) => new Set(current).add(userId))
          setFeedback({ userId, tone: 'error', text: message || 'Không thể gửi lời mời thách đấu.' })
        }
      } finally {
        setBusy(userId, false)
      }
    },
    [setBusy],
  )

  const cancel = useCallback(
    async (userId) => {
      const challengeId = sent[userId]
      if (!challengeId) return
      setFeedback(null)
      setBusy(userId, true)
      try {
        await challengeService.cancel(challengeId)
        setSent((current) => withoutEntry(current, userId))
      } catch (err) {
        const { code, message } = errorData(err)
        // Already answered or expired — there is nothing left to cancel.
        if (isDeadChallengeCode(code)) setSent((current) => withoutEntry(current, userId))
        setFeedback({ userId, tone: 'error', text: message || 'Không thể hủy lời mời thách đấu.' })
      } finally {
        setBusy(userId, false)
      }
    },
    [sent, setBusy],
  )

  const reject = useCallback(
    async (userId) => {
      const challengeId = received[userId]
      if (!challengeId) return
      setFeedback(null)
      setBusy(userId, true)
      try {
        await challengeService.reject(challengeId)
        setReceived((current) => withoutEntry(current, userId))
      } catch (err) {
        const { code, message } = errorData(err)
        if (isDeadChallengeCode(code)) setReceived((current) => withoutEntry(current, userId))
        setFeedback({ userId, tone: 'error', text: message || 'Không thể từ chối lời mời thách đấu.' })
      } finally {
        setBusy(userId, false)
      }
    },
    [received, setBusy],
  )

  const accept = useCallback(
    async (userId) => {
      const challengeId = received[userId]
      if (!challengeId) return
      setFeedback(null)
      setBusy(userId, true)
      const result = await challengeService.accept(challengeId)
      setBusy(userId, false)
      if (!result.ok) {
        if (isDeadChallengeCode(result.code)) setReceived((current) => withoutEntry(current, userId))
        setFeedback({ userId, tone: 'error', text: result.message || 'Không thể chấp nhận lời mời thách đấu.' })
        return
      }
      setReceived((current) => withoutEntry(current, userId))
      setAccepted((current) => new Set(current).add(userId))
      // The server has already seated this connection in the room and
      // started the match; saving the room id is what makes the match screen
      // resume it when it mounts (useRoom's rejoin handshake).
      saveRoomId(result.roomId)
      navigate('/room')
    },
    [received, setBusy, navigate],
  )

  // 'idle' | 'sent' | 'received' | 'accepted' | 'blocked'
  const stateFor = useCallback(
    (userId) => {
      if (accepted.has(userId)) return 'accepted'
      if (received[userId]) return 'received'
      if (sent[userId]) return 'sent'
      if (blocked.has(userId)) return 'blocked'
      return 'idle'
    },
    [accepted, received, sent, blocked],
  )

  // Everything <ChallengeButton> needs for one player.
  const propsFor = useCallback(
    (userId) => ({
      state: stateFor(userId),
      busy: busyIds.has(userId),
      onChallenge: () => challenge(userId),
      onCancel: () => cancel(userId),
      onAccept: () => accept(userId),
      onReject: () => reject(userId),
    }),
    [stateFor, busyIds, challenge, cancel, accept, reject],
  )

  const clearFeedback = useCallback(() => setFeedback(null), [])

  return { propsFor, stateFor, feedback, clearFeedback }
}

export default useChallenges
