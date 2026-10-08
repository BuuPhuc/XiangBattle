import api from '../config/axios'
import socket from '../socket/socket'

const ACCEPT_RESPONSE_TIMEOUT_MS = 8000

// Mirrors server/routes/challengeRoutes.js. The server takes the sender
// from the JWT — only the *other* player's id is ever sent.
export const challengeService = {
  // { sent: [{ id, userId }], received: [{ id, userId }] } — open challenges
  // in both directions, each naming the other player.
  getPending: () => api.get('/challenges/pending').then((res) => res.data),
  send: (receiverId) => api.post('/challenges', { receiverId }).then((res) => res.data),
  reject: (challengeId) => api.patch(`/challenges/${challengeId}/reject`).then((res) => res.data),
  cancel: (challengeId) => api.delete(`/challenges/${challengeId}`).then((res) => res.data),

  // Accepting seats this connection in the match room, so it goes over the
  // shared socket rather than REST (see server/sockets/challengeHandler.js).
  // Always resolves — { ok: true, roomId } or { ok: false, code, message } —
  // so callers branch on the result instead of catching.
  accept: (challengeId) =>
    new Promise((resolve) => {
      if (!socket.connected) {
        resolve({ ok: false, code: 'DISCONNECTED', message: 'Mất kết nối. Vui lòng thử lại.' })
        return
      }
      socket.timeout(ACCEPT_RESPONSE_TIMEOUT_MS).emit('accept_challenge', { challengeId }, (err, response) => {
        if (err || !response) {
          resolve({ ok: false, code: 'TIMEOUT', message: 'Không nhận được phản hồi. Vui lòng thử lại.' })
          return
        }
        resolve(response)
      })
    }),
}

// Server codes meaning "this challenge can no longer be answered at all" —
// as opposed to ones where it is still open and only this attempt failed
// (the challenger is offline or mid-game, you are still in another room).
const DEAD_CHALLENGE_CODES = new Set(['CHALLENGE_NOT_PENDING', 'CHALLENGE_EXPIRED', 'CHALLENGE_NOT_FOUND', 'CHALLENGE_FORBIDDEN'])

export function isDeadChallengeCode(code) {
  return DEAD_CHALLENGE_CODES.has(code)
}

export default challengeService
