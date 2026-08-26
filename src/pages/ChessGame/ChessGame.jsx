import { useCallback, useState } from 'react'
import ChessBoard from '../../components/game/ChessBoard'
import { useGame } from '../../features/game/hooks/useGame'
import { useTimer } from '../../features/game/hooks/useTimer'
import { formatClockTime } from '../../features/game/utils/timeUtils.js'
import PlayerCard from './sections/PlayerCard'
import CapturedPieces from './sections/CapturedPieces'
import MoveHistoryPanel from './sections/MoveHistoryPanel'
import MatchActions from './sections/MatchActions'
import MatchStatus from './sections/MatchStatus'
import GameOverModal from './sections/GameOverModal'

const RED_NAME = 'Bạn (Đỏ)'
const BLACK_NAME = 'Đại sư Lý'

export function ChessGame() {
  const {
    pieces,
    selectedId,
    turn,
    inCheck,
    status,
    winner,
    isGameOver,
    moveHistory,
    currentMoveIndex,
    isViewingHistory,
    selectSquare,
    goToMove,
    canUndo,
    canRedo,
    undo,
    redo,
    endGameByTimeout,
    resetGame,
  } = useGame()

  const handleTimeUp = useCallback((side, reason) => endGameByTimeout(side, reason), [endGameByTimeout])
  const { red: redTime, black: blackTime, resetTimer } = useTimer({ turn, isGameOver, onTimeUp: handleTimeUp })

  // The modal shows once per game-over (checkmate or timeout); dismissing it
  // just hides the popup (the board stays locked and browsable) without
  // resetting anything. Re-arms itself the moment a new game-over begins by
  // adjusting state during render (React's recommended alternative to an
  // effect for "reset state when a condition changes") rather than in an
  // effect, which would cause an extra cascading render.
  const [modalDismissed, setModalDismissed] = useState(false)
  const [prevIsGameOver, setPrevIsGameOver] = useState(isGameOver)
  if (isGameOver !== prevIsGameOver) {
    setPrevIsGameOver(isGameOver)
    if (isGameOver) setModalDismissed(false)
  }

  const handlePlayAgain = () => {
    resetGame()
    resetTimer()
    setModalDismissed(false)
  }

  // Captured pieces should reflect whatever position is currently displayed,
  // not the whole (possibly still-ongoing) game — so only count captures up
  // to the move being viewed.
  const visibleHistory = moveHistory.slice(0, currentMoveIndex + 1)

  return (
    <div className="w-full max-w-container-max mx-auto pb-12 flex flex-col xl:flex-row gap-gutter items-start justify-center">
      {isGameOver && !modalDismissed && (
        <GameOverModal
          winner={winner}
          status={status}
          redName={RED_NAME}
          blackName={BLACK_NAME}
          onClose={() => setModalDismissed(true)}
          onPlayAgain={handlePlayAgain}
        />
      )}

      {/* Left: opponent info & captures */}
      <div className="w-full xl:w-64 flex flex-row xl:flex-col gap-4 order-2 xl:order-1">
        <PlayerCard
          name={BLACK_NAME}
          elo={2450}
          side="black"
          moveTime={formatClockTime(blackTime.moveTime)}
          gameTime={formatClockTime(blackTime.gameTime)}
          online
          clockActive={!isGameOver && turn === 'black'}
        />
        <CapturedPieces moveHistory={visibleHistory} />
      </div>

      {/* Center: the board */}
      <div className="flex-grow flex flex-col items-center justify-center order-1 xl:order-2 w-full">
        {!isGameOver && (
          <MatchStatus
            turn={turn === 'red' ? 'Đỏ' : 'Đen'}
            inCheck={inCheck}
            isViewingHistory={isViewingHistory}
            viewedMoveNumber={currentMoveIndex + 1}
            onReturnToLive={() => goToMove(moveHistory.length - 1)}
          />
        )}
        <div className={`w-full ${isGameOver ? 'opacity-60 pointer-events-none' : ''}`}>
          <ChessBoard pieces={pieces} selectedId={selectedId} onSquareClick={selectSquare} />
        </div>
      </div>

      {/* Right: your info, history & actions */}
      <div className="w-full xl:w-80 flex flex-col gap-6 order-3">
        <PlayerCard
          name={RED_NAME}
          elo={2410}
          side="red"
          moveTime={formatClockTime(redTime.moveTime)}
          gameTime={formatClockTime(redTime.gameTime)}
          clockActive={!isGameOver && turn === 'red'}
          accentClassName="border-b-4 border-b-error"
        />
        <MoveHistoryPanel moveHistory={moveHistory} currentMoveIndex={currentMoveIndex} onSelectMove={goToMove} />
        <MatchActions canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo} />
      </div>
    </div>
  )
}

export default ChessGame
