// Display metadata for the Academy. Piece `type` values are the same ones
// features/game uses (see initialPosition.js / gameLogic.js), so a challenge
// position is fed straight into the existing rules without any mapping.

export const PLAYER_SIDE = 'red'

export const PIECE_CHARS = {
  red: { rook: '俥', horse: '傌', elephant: '相', advisor: '仕', general: '帥', cannon: '炮', pawn: '兵' },
  black: { rook: '車', horse: '馬', elephant: '象', advisor: '士', general: '將', cannon: '炮', pawn: '卒' },
}

export const PIECE_NAMES = {
  rook: 'Xe',
  horse: 'Mã',
  elephant: 'Tượng',
  advisor: 'Sĩ',
  general: 'Tướng',
  cannon: 'Pháo',
  pawn: 'Tốt',
}

// Course levels — also the Academy landing page's category filter.
export const COURSE_LEVELS = [
  { id: 'beginner', label: 'Người mới bắt đầu' },
  { id: 'elementary', label: 'Nhập môn' },
  { id: 'intermediate', label: 'Trung cấp' },
  { id: 'advanced', label: 'Nâng cao' },
]

export const LESSON_STATUS = {
  NOT_STARTED: 'not-started',
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'completed',
}

// The main action on a lesson, by how far the learner has got.
export const LESSON_ACTION_LABEL = {
  [LESSON_STATUS.NOT_STARTED]: 'Bắt đầu thử thách',
  [LESSON_STATUS.IN_PROGRESS]: 'Tiếp tục học',
  [LESSON_STATUS.COMPLETED]: 'Ôn tập',
}

export const DEFAULT_MESSAGES = {
  success: 'Chính xác!',
  stepSuccess: 'Tốt lắm! Hãy đi tiếp nước tiếp theo.',
  failure: 'Nước đi chưa đúng. Hãy thử lại.',
  illegal: 'Quân cờ không thể đi như vậy. Hãy thử lại.',
}
