import ChessBoard from '../../components/game/ChessBoard'
import { useGame } from '../../features/game/hooks/useGame'
import PlayerCard from './sections/PlayerCard'
import CapturedPieces from './sections/CapturedPieces'
import MoveHistoryPanel from './sections/MoveHistoryPanel'
import MatchActions from './sections/MatchActions'
import MatchStatus from './sections/MatchStatus'
import GameOverBanner from './sections/GameOverBanner'

export function ChessGame() {
  const {
    pieces,
    selectedId,
    turn,
    inCheck,
    status,
    winner,
    moveHistory,
    currentMoveIndex,
    isViewingHistory,
    selectSquare,
    goToMove,
  } = useGame()
  const isGameOver = status === 'checkmate'

  // Captured pieces should reflect whatever position is currently displayed,
  // not the whole (possibly still-ongoing) game — so only count captures up
  // to the move being viewed.
  const visibleHistory = moveHistory.slice(0, currentMoveIndex + 1)

  return (
    <div className="w-full max-w-container-max mx-auto pb-12 flex flex-col xl:flex-row gap-gutter items-start justify-center">
      {/* Left: opponent info & captures */}
      <div className="w-full xl:w-64 flex flex-row xl:flex-col gap-4 order-2 xl:order-1">
        <PlayerCard name="Đại sư Lý" elo={2450} side="black" clock="08:42" online clockActive={turn === 'black'} />
        <CapturedPieces moveHistory={visibleHistory} />
      </div>

      {/* Center: the board */}
      <div className="flex-grow flex flex-col items-center justify-center order-1 xl:order-2 w-full">
        {isGameOver ? (
          <GameOverBanner winner={winner} />
        ) : (
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
          name="Bạn (Đỏ)"
          elo={2410}
          side="red"
          clock="12:34"
          clockActive={turn === 'red'}
          accentClassName="border-b-4 border-b-error"
        />
        <MoveHistoryPanel moveHistory={moveHistory} currentMoveIndex={currentMoveIndex} onSelectMove={goToMove} />
        <MatchActions />
      </div>
    </div>
  )
}

export default ChessGame
