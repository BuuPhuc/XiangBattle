import { useCallback, useEffect, useRef, useState } from 'react'
import ChessBoard from '../../components/game/ChessBoard'
import { useGame } from '../../features/game/hooks/useGame'
import { useTimer } from '../../features/game/hooks/useTimer'
import { useOnlineGame } from '../../features/room/hooks/useOnlineGame'
import { useChat } from '../../features/chat/hooks/useChat'
import { GAME_STATUS, findPieceAt } from '../../features/game/gameLogic.js'
import { getLegalMovesForPiece } from '../../features/game/utils/moveUtils.js'
import { formatClockTime } from '../../features/game/utils/timeUtils.js'
import PlayerCard from './sections/PlayerCard'
import GameHistoryPanel from './sections/GameHistoryPanel'
import MatchActions from './sections/MatchActions'
import UndoRedoControls from './sections/UndoRedoControls'
import MatchStatus from './sections/MatchStatus'
import GameOverModal from './sections/GameOverModal'

const RED_NAME = 'Bạn (Đỏ)'
const BLACK_NAME = 'Đại sư Lý'

// `onlineGame` is undefined for the local/offline board (default — both
// sides playable from one screen, opponent is the built-in placeholder
// name). When provided as { yourColor, roomId, moveHistory, matchResult,
// timerState, messages }, this same component becomes the online match
// view: only your own color's pieces are selectable on your turn, the cards
// read "Bạn" / "Đối thủ", every locally-committed move is relayed to the
// opponent through the server (useOnlineGame) while the opponent's moves
// are applied back in via applyRemoteMove, and — for a resumed match after
// a reconnect — moveHistory/matchResult/timerState/messages seed
// useGame/useTimer/useChat instead of starting fresh. The parent is
// expected to change this component's `key` whenever it hands down a new
// restored snapshot, so these seed values are only ever consulted at mount.
export function ChessGame({ onlineGame }) {
  const {
    pieces,
    selectedId,
    selectedPiece,
    turn,
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
    lastLocalMove,
    applyRemoteMove,
  } = useGame({ initialMoveHistory: onlineGame?.moveHistory, initialMatchResult: onlineGame?.matchResult })

  const handleTimeUp = useCallback((side, reason) => endGameByTimeout(side, reason), [endGameByTimeout])
  const { red: redTime, black: blackTime, resetTimer } = useTimer({
    turn,
    isGameOver,
    onTimeUp: handleTimeUp,
    initialTimes: onlineGame?.timerState,
  })

  // Online: relay this client's own moves to the server, and apply
  // whatever the opponent's move turns out to be once the server confirms
  // it. If the server ever rejects a move this client already applied
  // optimistically (e.g. a rare race), undo() cleanly rolls it back — it's
  // pure navigation, so nothing is lost, the branch just gets replaced the
  // next time a real move is made. onGameOver applies a result the server
  // knows about but this client hasn't necessarily derived itself yet (a
  // disconnect forfeit, or the opponent's clock running out) the exact
  // same way a local timeout already does — endGameByTimeout never touches
  // moveHistory, so this is safe to call on an already-live game.
  const isOnline = Boolean(onlineGame && onlineGame.yourColor)
  const handleGameOver = useCallback((result) => endGameByTimeout(result.loser, result.status), [endGameByTimeout])
  const { sendMove, error: moveError, reportGameOver, playAgain, resign, drawOffer, offerDraw, respondDraw } = useOnlineGame({
    enabled: isOnline,
    onOpponentMove: applyRemoteMove,
    onMoveRejected: undo,
    onGameOver: handleGameOver,
  })

  useEffect(() => {
    if (isOnline && lastLocalMove) sendMove(lastLocalMove)
  }, [isOnline, lastLocalMove, sendMove])

  // Chat is only meaningful for an online match (there's no opponent to
  // chat with locally) — same enable pattern as useOnlineGame, and seeded
  // from the same restored snapshot (onlineGame.messages) the same way
  // moveHistory/timerState seed useGame/useTimer above.
  const { messages: chatMessages, unreadCount, sendMessage: sendChatMessage, markRead: markChatRead } = useChat({
    enabled: isOnline,
    initialMessages: onlineGame?.messages,
  })

  // The other half of onGameOver above: once *this* client locally derives
  // a game-over (checkmate, or its own clock timing out), report it to the
  // server so the room's authoritative record reflects it — that's what
  // lets reconnect later tell "finished" from "still playing" (a forfeit
  // is already server-known, so it's excluded to avoid an idle round trip).
  // Guarded to fire exactly once per game-over instance.
  const reportedGameOverRef = useRef(false)
  useEffect(() => {
    if (!isOnline || !isGameOver) {
      reportedGameOverRef.current = false
      return
    }
    if (reportedGameOverRef.current || status === GAME_STATUS.OPPONENT_LEFT) return
    reportedGameOverRef.current = true
    reportGameOver(status, winner)
  }, [isOnline, isGameOver, status, winner, reportGameOver])

  const redName = onlineGame ? (onlineGame.yourColor === 'red' ? 'Bạn' : 'Đối thủ') : RED_NAME
  const blackName = onlineGame ? (onlineGame.yourColor === 'black' ? 'Bạn' : 'Đối thủ') : BLACK_NAME

  // Online: the server already told each client whose color it is — a
  // player is only allowed to act on their own turn, and only while
  // looking at the live position (not browsing history via undo/redo or
  // Move History — acting from there would silently branch this client's
  // history away from the server's, so it's blocked here rather than
  // needing to disable those controls separately). Local/offline play is
  // untouched either way.
  const handleSquareClick = isOnline
    ? (col, row) => {
        if (!isViewingHistory && turn === onlineGame.yourColor) selectSquare(col, row)
      }
    : selectSquare

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
    if (isOnline) {
      // Ask the server for a rematch in this same room — it resets the
      // shared match (board/history/timer/result, same colors) and
      // broadcasts a fresh game_started to both players, which is what
      // actually remounts this component with clean state (see the `key`
      // the parent sets from useRoom's restoreVersion). Resetting only
      // this client's local state here would desync it from the
      // opponent's realtime-synced copy, so this never touches resetGame.
      playAgain()
      return
    }
    resetGame()
    resetTimer()
    setModalDismissed(false)
  }

  // Captured pieces should reflect whatever position is currently displayed,
  // not the whole (possibly still-ongoing) game — so only count captures up
  // to the move being viewed. Only black's captures (i.e. red pieces black
  // has taken) are tracked here, same scope the old standalone
  // CapturedPieces panel had — shown inline on black's PlayerCard now.
  const visibleHistory = moveHistory.slice(0, currentMoveIndex + 1)
  const blackCapturedPieces = visibleHistory.filter((move) => move.turn === 'black' && move.captured).map((move) => move.captured)

  // Legal-move dots for whichever piece is currently selected — reuses the
  // existing move-validation engine (moveUtils.js) as-is, this only maps its
  // result into the shape ChessBoard/MoveMarker render. Empty once nothing
  // is selected (goToMove/undo/redo already clear selectedId themselves).
  const legalMoves = selectedPiece
    ? getLegalMovesForPiece(selectedPiece, pieces).map((move) => ({
        ...move,
        capture: Boolean(findPieceAt(pieces, move.col, move.row)),
      }))
    : []

  return (
    <div className="w-full max-w-container-max mx-auto flex flex-col xl:flex-row gap-gutter justify-center">
      {isGameOver && !modalDismissed && (
        <GameOverModal
          winner={winner}
          status={status}
          redName={redName}
          blackName={blackName}
          youWon={isOnline ? onlineGame.yourColor === winner : undefined}
          onClose={() => setModalDismissed(true)}
          onPlayAgain={handlePlayAgain}
        />
      )}

      {/* Left: the board, bigger, with match actions right below it */}
      <div className="flex-grow flex flex-col items-center order-1 w-full xl:max-w-[780px]">
        {isOnline && moveError && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-error/10 border border-error/30 text-error font-label-md text-label-md text-center">
            {moveError}
          </div>
        )}
        {!isGameOver && isViewingHistory && (
          <MatchStatus viewedMoveNumber={currentMoveIndex + 1} onReturnToLive={() => goToMove(moveHistory.length - 1)} />
        )}
        <div className={`w-full ${isGameOver ? 'opacity-60 pointer-events-none' : ''}`}>
          <ChessBoard pieces={pieces} selectedId={selectedId} turn={turn} legalMoves={legalMoves} onSquareClick={handleSquareClick} />
        </div>
        <div className="w-full mt-3">
          <MatchActions
            canResign={isOnline && !isGameOver}
            onResign={isOnline ? resign : undefined}
            canOfferDraw={isOnline && !isGameOver}
            drawOfferPending={isOnline && drawOffer === 'outgoing'}
            onOfferDraw={isOnline ? offerDraw : undefined}
            incomingDrawOffer={isOnline && !isGameOver && drawOffer === 'incoming'}
            onRespondDraw={isOnline ? respondDraw : undefined}
          />
        </div>
      </div>

      {/* Right: compact opponent bar above, compact own bar below,
          sandwiching a much bigger history/chat panel that stretches to
          match the board column's height (see GameHistoryPanel.jsx). */}
      <div className="w-full xl:w-96 flex flex-col gap-3 order-2">
        <PlayerCard
          name={blackName}
          elo={2450}
          side="black"
          moveTime={formatClockTime(blackTime.moveTime)}
          gameTime={formatClockTime(blackTime.gameTime)}
          online
          clockActive={!isGameOver && turn === 'black'}
          capturedPieces={blackCapturedPieces}
        />
        <GameHistoryPanel
          moveHistory={moveHistory}
          currentMoveIndex={currentMoveIndex}
          onSelectMove={goToMove}
          chat={isOnline ? { messages: chatMessages, unreadCount, sendMessage: sendChatMessage, markRead: markChatRead } : null}
        />
        <PlayerCard
          name={redName}
          elo={2410}
          side="red"
          moveTime={formatClockTime(redTime.moveTime)}
          gameTime={formatClockTime(redTime.gameTime)}
          clockActive={!isGameOver && turn === 'red'}
          accentClassName="border-b-4 border-b-error"
        />
        <UndoRedoControls canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo} />
      </div>
    </div>
  )
}

export default ChessGame
