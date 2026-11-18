import { GAME_STATUS } from '../../features/game/gameLogic.js'

// Result wording for someone watching — neither side is "you", so every
// sentence names the players.

const DRAW_STATUSES = new Set([GAME_STATUS.DRAW, GAME_STATUS.REPETITION_DRAW])

const REASON = {
  [GAME_STATUS.CHECKMATE]: 'chiếu bí',
  [GAME_STATUS.STALEMATE]: 'đối phương hết nước đi',
  [GAME_STATUS.TIMEOUT_MOVE]: 'đối phương hết giờ đi quân',
  [GAME_STATUS.TIMEOUT_GAME]: 'đối phương hết giờ ván đấu',
  [GAME_STATUS.OPPONENT_LEFT]: 'đối phương rời trận',
  [GAME_STATUS.RESIGN]: 'đối phương đầu hàng',
  [GAME_STATUS.PERPETUAL_CHECK]: 'đối phương chiếu dai',
  [GAME_STATUS.PERPETUAL_CHASE]: 'đối phương đuổi dai',
}

export function describeSpectatorResult(result, names) {
  if (!result) return null
  if (DRAW_STATUSES.has(result.status) || !result.winner) {
    return result.status === GAME_STATUS.REPETITION_DRAW ? 'Hòa do lặp nước' : 'Hai bên hòa cờ'
  }
  const reason = REASON[result.status] ?? REASON[GAME_STATUS.CHECKMATE]
  return `${names[result.winner]} thắng — ${reason}`
}

export const COLOR_LABEL = { red: 'Đỏ', black: 'Đen' }
