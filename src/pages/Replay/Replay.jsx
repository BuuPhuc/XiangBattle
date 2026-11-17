import { useEffect, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Icon from '../../components/ui/Icon'
import Button from '../../components/ui/Button'
import ChessBoard from '../../components/game/ChessBoard'
import GameHistoryPanel from '../ChessGame/sections/GameHistoryPanel'
import { useReplayGame } from '../../features/replay/hooks/useReplayGame'
import { useAuth } from '../../components/hooks/useAuth'
import { useSelector } from 'react-redux'
import { selectArrowsEnabled, selectSoundEnabled } from '../../store/slices/settingsSlice'
import { moveSoundFor } from '../../features/sound/moveSound.js'
import { playSound } from '../../features/sound/soundPlayer.js'
import { formatSavedTimeControl } from '../../features/game/timeControls.js'
import { useGameAnalysis } from '../../features/analysis/useGameAnalysis'
import { gamePositions, gradeGame, bestMoveAt, summarize } from '../../features/analysis/analysis.js'
import { gradeStyle } from '../../features/analysis/gradeStyles.js'
import AnalysisPanel from './sections/AnalysisPanel'
import EvalBar from './sections/EvalBar'

// End reasons where the last move itself finished the game — stepping onto
// that move plays the game-end sound instead of the move's own.
const ENDED_BY_LAST_MOVE = new Set(['CHECKMATE', 'STALEMATE'])

const END_REASON_LABEL = {
  CHECKMATE: 'Chiếu bí',
  RESIGN: 'Đầu hàng',
  TIMEOUT: 'Hết giờ',
  DRAW_AGREEMENT: 'Hòa cờ',
  STALEMATE: 'Hết nước đi',
  REPETITION: 'Lặp nước',
  DISCONNECT: 'Đối thủ rời trận',
  CANCELLED: 'Đã hủy',
}

const RESULT_LABEL = {
  RED_WIN: 'Đỏ thắng',
  BLACK_WIN: 'Đen thắng',
  DRAW: 'Hòa',
}

function playerLabel(player) {
  return player ? player.displayName || player.username : '—'
}

// Read-only playback of a finished match, reached from GameOverModal's "Xem
// lại ván đấu" button. Reuses the exact same board/history components the
// live game uses (ChessBoard, GameHistoryPanel) — only the data source
// differs: pieces/turn here come from useReplayGame's precomputed
// moveHistory instead of a live socket-driven useGame, and the board is
// wired to a no-op click handler so nothing here can ever move a piece,
// emit a socket event, or touch the database.
//
// Phân tích ván (AnalysisPanel, useGameAnalysis) runs here too, on demand —
// or straight away when opened with ?analyze=1 (the "Phân tích" button on a
// game card, see GameHistoryCard).
export function Replay() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const {
    status,
    error,
    game,
    moveHistory,
    currentMoveIndex,
    pieces,
    turn,
    goToMove,
    goToStart,
    goToEnd,
    goPrev,
    goNext,
    canGoPrev,
    canGoNext,
    reload,
  } = useReplayGame(gameId)

  const { user } = useAuth()
  const soundEnabled = useSelector(selectSoundEnabled)
  const arrowsEnabled = useSelector(selectArrowsEnabled)

  const handleExit = () => navigate('/play')

  const analysis = useGameAnalysis(gameId, status === 'ready' ? moveHistory : null)
  const { status: analysisStatus, start: startAnalysis, evals } = analysis

  // ?analyze=1 is a one-shot instruction from a game card's "Phân tích"
  // button: start once the game has loaded (unless it's already analysed),
  // then drop it from the address so going back here later doesn't restart.
  const [searchParams, setSearchParams] = useSearchParams()
  const autoAnalyzeRef = useRef(false)
  useEffect(() => {
    if (status !== 'ready' || searchParams.get('analyze') !== '1') return
    setSearchParams({}, { replace: true })
    if (autoAnalyzeRef.current) return
    autoAnalyzeRef.current = true
    if (analysisStatus === 'idle') startAnalysis()
  }, [status, searchParams, setSearchParams, analysisStatus, startAnalysis])

  // Only "Nước tiếp theo" plays a sound (stepping one move forward, like
  // watching it being played). Going back, jumping to the start/end or
  // clicking a move in the list stays silent.
  const handleNext = () => {
    const next = moveHistory[currentMoveIndex + 1]
    if (next && soundEnabled) {
      const isFinalMove = currentMoveIndex + 1 === moveHistory.length - 1
      playSound(moveSoundFor(next, { gameOver: isFinalMove && ENDED_BY_LAST_MOVE.has(game?.endReason) }))
    }
    goNext()
  }

  if (status === 'loading') {
    return (
      <div className="max-w-xl mx-auto py-24 px-4 text-center space-y-3">
        <span className="w-3 h-3 rounded-full bg-secondary animate-pulse inline-block" />
        <p className="font-body-md text-body-md text-on-surface-variant">Đang tải ván đấu...</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="max-w-xl mx-auto py-24 px-4 text-center space-y-4">
        <p className="font-body-md text-body-md text-error">{error}</p>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={reload}>Thử lại</Button>
          <Button variant="outline" onClick={handleExit}>
            Quay lại
          </Button>
        </div>
      </div>
    )
  }

  // Replaying your own game as black shows it from your side, same as the
  // live board did. Anyone else's game (or as red) stays red-at-bottom.
  const viewerWasBlack = user?.id != null && game.blackPlayer?.id === user.id

  // What the analysis says about the position shown (currentMoveIndex + 1 in
  // positions) and the move that led to it (moveHistory[currentMoveIndex]).
  const positions = gamePositions(moveHistory)
  const grades = evals ? gradeGame(moveHistory, evals) : null
  const shownEvaluation = evals?.[currentMoveIndex + 1]
  const nextBest = evals ? bestMoveAt(positions, evals, currentMoveIndex + 1) : null
  const shownMove =
    currentMoveIndex >= 0
      ? {
          number: Math.floor(currentMoveIndex / 2) + 1,
          side: moveHistory[currentMoveIndex].turn,
          notation: moveHistory[currentMoveIndex].notation,
          grade: grades?.[currentMoveIndex] ?? null,
        }
      : null
  const showAnalysis = analysisStatus !== 'idle'

  return (
    <div className="w-full max-w-container-max mx-auto flex flex-col xl:flex-row gap-gutter justify-center">
      <div className="flex-grow flex flex-col items-center order-1 w-full xl:max-w-[780px]">
        <div className="w-full mb-3 glass-panel border border-gold-shimmer/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 font-label-md text-label-md">
            <span className="text-error">{playerLabel(game.redPlayer)}</span>
            <span className="text-on-surface-variant">vs</span>
            <span>{playerLabel(game.blackPlayer)}</span>
          </div>
          <div className="font-label-sm text-label-sm text-on-surface-variant text-right">
            {formatSavedTimeControl(game.initialTime, game.increment) && (
              <span className="tabular-nums">Ván {formatSavedTimeControl(game.initialTime, game.increment)} · </span>
            )}
            {RESULT_LABEL[game.result] || game.result} · {END_REASON_LABEL[game.endReason] || game.endReason}
          </div>
        </div>

        {/* board-readonly: nothing on the board responds to a click (as
            before), but the board itself still takes the drawing gestures. */}
        <div className="w-full flex items-stretch gap-2">
          {showAnalysis && <EvalBar evaluation={shownEvaluation} flipped={viewerWasBlack} />}
          <div className="flex-1 min-w-0 board-readonly select-none">
            <ChessBoard
              pieces={pieces}
              selectedId={null}
              turn={turn}
              legalMoves={[]}
              onSquareClick={() => {}}
              flipped={viewerWasBlack}
              lastMove={currentMoveIndex >= 0 ? moveHistory[currentMoveIndex] : null}
              drawingEnabled={arrowsEnabled}
              hintArrows={nextBest ? [{ from: nextBest.from, to: nextBest.to }] : []}
            />
          </div>
        </div>

        <div className="w-full mt-3 glass-panel border border-gold-shimmer/30 rounded-xl px-4 py-2.5 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={goToStart}
            disabled={!canGoPrev}
            className="p-2 rounded hover:bg-surface-container disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            aria-label="Về đầu"
          >
            <Icon name="first_page" />
          </button>
          <button
            type="button"
            onClick={goPrev}
            disabled={!canGoPrev}
            className="p-2 rounded hover:bg-surface-container disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            aria-label="Nước trước"
          >
            <Icon name="chevron_left" />
          </button>
          <span className="font-label-md text-label-md text-on-surface-variant px-3 tabular-nums">
            {currentMoveIndex + 1} / {moveHistory.length}
          </span>
          <button
            type="button"
            onClick={handleNext}
            disabled={!canGoNext}
            className="p-2 rounded hover:bg-surface-container disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            aria-label="Nước tiếp theo"
          >
            <Icon name="chevron_right" />
          </button>
          <button
            type="button"
            onClick={goToEnd}
            disabled={!canGoNext}
            className="p-2 rounded hover:bg-surface-container disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            aria-label="Đến cuối"
          >
            <Icon name="last_page" />
          </button>
        </div>

        <div className="w-full mt-3 flex justify-center">
          <Button variant="outline" onClick={handleExit}>
            <Icon name="arrow_back" />
            Thoát xem lại
          </Button>
        </div>
      </div>

      <div className="w-full xl:w-96 flex flex-col gap-3 order-2">
        <AnalysisPanel
          analysis={analysis}
          evaluation={shownEvaluation}
          shownMove={shownMove}
          nextBest={nextBest}
          summary={analysisStatus === 'done' && grades ? summarize(moveHistory, grades) : null}
        />
        <GameHistoryPanel
          moveHistory={moveHistory}
          currentMoveIndex={currentMoveIndex}
          onSelectMove={goToMove}
          chat={null}
          annotations={grades ? grades.map((grade) => gradeStyle(grade?.grade)) : undefined}
        />
      </div>
    </div>
  )
}

export default Replay
