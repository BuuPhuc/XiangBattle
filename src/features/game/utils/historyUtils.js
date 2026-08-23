// Pure helpers for navigating/displaying move history. Kept separate from
// useGame.js (owns the state) and MoveHistoryPanel.jsx (renders it) so each
// file has exactly one job.
import { RED, otherTurn } from '../gameLogic.js'
import { INITIAL_PIECES } from '../initialPosition.js'

// index === -1 means "before any move" (the initial position). index N means
// "the board right after moveHistory[N] was played".
export function getPiecesAtIndex(moveHistory, index) {
  return index === -1 ? INITIAL_PIECES : moveHistory[index].piecesAfter
}

export function getTurnAtIndex(moveHistory, index) {
  return index === -1 ? RED : otherTurn(moveHistory[index].turn)
}

// Groups the flat, chronological move list into red/black pairs for the
// history table. Each cell keeps its own index into the original array so
// individual moves — not just rows — stay independently clickable.
export function groupMovesIntoRows(moveHistory) {
  const rows = []

  moveHistory.forEach((move, index) => {
    if (move.turn === 'red') {
      rows.push({ number: rows.length + 1, red: move, redIndex: index, black: null, blackIndex: null })
    } else if (rows.length > 0) {
      const row = rows[rows.length - 1]
      row.black = move
      row.blackIndex = index
    }
  })

  return rows
}
