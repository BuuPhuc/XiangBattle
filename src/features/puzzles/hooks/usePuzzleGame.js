import { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { otherTurn } from '../../game/gameLogic.js'
import { findPieceAt } from '../../game/utils/boardUtils.js'
import { isFullyLegalMove, getLegalMovesForPiece } from '../../game/utils/moveUtils.js'
import { createMoveEntry } from '../../game/utils/moveEntry.js'
import { PIECE_NAMES } from '../../academy/constants.js'
import { moveSoundFor, SOUND } from '../../sound/moveSound.js'
import { playSound, preloadSounds } from '../../sound/soundPlayer.js'
import { selectSoundEnabled } from '../../../store/slices/settingsSlice'
import { markPuzzleSolved, markSolutionViewed } from '../../../store/slices/puzzlesSlice'
import { MOVE_VERDICT } from '../engine/solver.js'
import { buildPuzzlePieces } from '../engine/puzzle.js'
import usePuzzleSolver from './usePuzzleSolver'

// How long a move stays on the board before the computer answers it /
// before a wrong move is taken back / between moves of a shown solution.
const REPLY_DELAY_MS = 550
const WRONG_UNDO_MS = 1100
const DEMO_STEP_MS = 900

export const PHASE = {
  PLAYER: 'player', // the player's turn
  CHECKING: 'checking', // the solver is judging the player's move
  REPLY: 'reply', // correct — the computer is about to defend
  WRONG: 'wrong', // shown briefly, then taken back
  SOLVED: 'solved',
  DEMO: 'demo', // "Xem lời giải" is playing
  DEMO_DONE: 'demo-done',
}

// One Cờ thế attempt (the page remounts it per puzzle). Only the player's
// side can be moved, only on their turn; every move goes to the solver
// (Web Worker), which accepts it only if EVERY defence still loses in the
// moves left. On a correct move the computer plays the longest defence; a
// wrong move is shown, explained and taken back. Nothing here touches the
// server, the online game, Elo or game history — only this browser's
// puzzle progress (Redux → localStorage).
export function usePuzzleGame(puzzle) {
  const ask = usePuzzleSolver()
  const dispatch = useDispatch()
  const soundEnabled = useSelector(selectSoundEnabled)
  const attacker = puzzle.toMove
  const defender = otherTurn(attacker)
  const startPieces = useMemo(() => buildPuzzlePieces(puzzle), [puzzle])

  const [history, setHistory] = useState([])
  const [phase, setPhase] = useState(PHASE.PLAYER)
  const [selectedId, setSelectedId] = useState(null)
  const [message, setMessage] = useState(null) // { tone: 'info' | 'success' | 'error', text } | null
  // Bumped by every reset / new request: answers and timers from an older
  // attempt are ignored.
  const attempt = useRef(0)
  const timers = useRef([])

  const pieces = history.length > 0 ? history[history.length - 1].piecesAfter : startPieces
  const turn = history.length % 2 === 0 ? attacker : defender
  // Attacker moves used so far = ceil(history / 2).
  const remaining = puzzle.moves - Math.ceil(history.length / 2)
  const selectedPiece = pieces.find((p) => p.id === selectedId) ?? null

  useEffect(() => {
    if (soundEnabled) preloadSounds()
  }, [soundEnabled])

  useEffect(
    () => () => {
      for (const t of timers.current) clearTimeout(t)
    },
    []
  )

  const sound = (name) => {
    if (soundEnabled && name) playSound(name)
  }
  const later = (fn, ms) => {
    const mine = attempt.current
    timers.current.push(
      setTimeout(() => {
        if (mine === attempt.current) fn()
      }, ms)
    )
  }
  const startOver = () => {
    attempt.current++
    for (const t of timers.current) clearTimeout(t)
    timers.current = []
  }

  const playEntry = (before, move, ply) => {
    const piece = findPieceAt(before, move.from[0], move.from[1])
    return createMoveEntry(before, piece, move.to[0], move.to[1], ply)
  }

  const submit = (piece, col, row) => {
    const before = pieces
    const entry = createMoveEntry(before, piece, col, row, history.length + 1)
    const ply = history.length + 1
    setHistory((h) => [...h, entry])
    setSelectedId(null)
    setPhase(PHASE.CHECKING)
    setMessage(null)

    attempt.current++
    const mine = attempt.current
    ask('judge', { pieces: before, attacker, move: { from: [piece.col, piece.row], to: [col, row] }, remaining })
      .then((result) => {
        if (mine !== attempt.current) return
        if (result.verdict === MOVE_VERDICT.WIN) {
          sound(SOUND.GAME_END)
          setPhase(PHASE.SOLVED)
          setMessage({ tone: 'success', text: 'Chính xác! Bạn đã chiếu bí — thế cờ đã được giải.' })
          dispatch(markPuzzleSolved(puzzle.id))
        } else if (result.verdict === MOVE_VERDICT.CORRECT && result.reply) {
          sound(moveSoundFor(entry))
          setPhase(PHASE.REPLY)
          setMessage({ tone: 'success', text: 'Chính xác! Đối phương đang chống đỡ…' })
          later(() => {
            const reply = playEntry(entry.piecesAfter, result.reply, ply + 1)
            setHistory((h) => [...h, reply])
            sound(moveSoundFor(reply))
            setPhase(PHASE.PLAYER)
            setMessage({ tone: 'info', text: `Đến lượt bạn — còn ${remaining - 1} nước để chiếu bí.` })
          }, REPLY_DELAY_MS)
        } else {
          sound(moveSoundFor(entry))
          setPhase(PHASE.WRONG)
          setMessage({
            tone: 'error',
            text:
              remaining <= 1
                ? 'Chưa đúng: nước này chưa chiếu bí. Thử lại nhé!'
                : `Chưa đúng: sau nước này đối phương vẫn có cách thoát khỏi bị chiếu bí trong ${remaining} nước. Thử lại nhé!`,
          })
          later(() => {
            setHistory((h) => h.slice(0, -1))
            setPhase(PHASE.PLAYER)
          }, WRONG_UNDO_MS)
        }
      })
      .catch(() => {
        if (mine !== attempt.current) return
        setHistory((h) => h.slice(0, -1))
        setPhase(PHASE.PLAYER)
        setMessage({ tone: 'error', text: 'Không kiểm tra được nước đi. Vui lòng thử lại.' })
      })
  }

  const selectSquare = (col, row) => {
    if (phase !== PHASE.PLAYER) return
    const target = findPieceAt(pieces, col, row)
    if (!selectedPiece) {
      if (target && target.side === attacker) setSelectedId(target.id)
      return
    }
    if (target && target.id === selectedPiece.id) {
      setSelectedId(null)
      return
    }
    if (target && target.side === attacker) {
      setSelectedId(target.id)
      return
    }
    if (!isFullyLegalMove(selectedPiece, col, row, pieces)) return
    submit(selectedPiece, col, row)
  }

  const hint = () => {
    if (phase !== PHASE.PLAYER) return
    const mine = attempt.current
    ask('hint', { pieces, attacker, remaining })
      .then(({ move }) => {
        if (mine !== attempt.current || !move) return
        const piece = findPieceAt(pieces, move.from[0], move.from[1])
        if (!piece) return
        setSelectedId(piece.id)
        setMessage({ tone: 'info', text: `Gợi ý: hãy đi quân ${PIECE_NAMES[piece.type] ?? ''} đang được chọn.` })
      })
      .catch(() => {})
  }

  const reset = () => {
    startOver()
    setHistory([])
    setSelectedId(null)
    setPhase(PHASE.PLAYER)
    setMessage(null)
  }

  // Plays a full solution from the start position. Recorded as "viewed",
  // never as solved; "Làm lại" then lets the player solve it unaided.
  const showSolution = () => {
    startOver()
    dispatch(markSolutionViewed(puzzle.id))
    setHistory([])
    setSelectedId(null)
    setPhase(PHASE.DEMO)
    setMessage({ tone: 'info', text: 'Đang xem lời giải…' })
    const mine = attempt.current
    ask('solution', { pieces: startPieces, attacker, remaining: puzzle.moves })
      .then(({ line }) => {
        if (mine !== attempt.current || !line) return
        let board = startPieces
        line.forEach((move, index) => {
          const entry = playEntry(board, move, index + 1)
          board = entry.piecesAfter
          const isLast = index === line.length - 1
          later(() => {
            setHistory((h) => [...h, entry])
            sound(isLast ? SOUND.GAME_END : moveSoundFor(entry))
            if (isLast) {
              setPhase(PHASE.DEMO_DONE)
              setMessage({
                tone: 'info',
                text: 'Đây là một lời giải. Bấm "Làm lại" để tự giải — tự giải được mới tính là Đã giải.',
              })
            }
          }, DEMO_STEP_MS * (index + 1))
        })
      })
      .catch(() => {
        if (mine !== attempt.current) return
        setPhase(PHASE.PLAYER)
        setMessage({ tone: 'error', text: 'Không tải được lời giải. Vui lòng thử lại.' })
      })
  }

  const legalMoves = selectedPiece
    ? getLegalMovesForPiece(selectedPiece, pieces).map((m) => ({ ...m, capture: Boolean(findPieceAt(pieces, m.col, m.row)) }))
    : []

  return {
    attacker,
    pieces,
    turn,
    remaining,
    phase,
    message,
    selectedId,
    legalMoves,
    lastMove: history.length > 0 ? history[history.length - 1] : null,
    selectSquare,
    hint,
    reset,
    showSolution,
  }
}

export default usePuzzleGame
