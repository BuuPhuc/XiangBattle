import { useCallback, useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import ChessBoard from '../../components/game/ChessBoard'
import { useGame } from '../../features/game/hooks/useGame'
import { useTimer } from '../../features/game/hooks/useTimer'
import { useOnlineGame } from '../../features/room/hooks/useOnlineGame'
import { useChat } from '../../features/chat/hooks/useChat'
import useAuth from '../../components/hooks/useAuth'
import { GAME_STATUS, findPieceAt } from '../../features/game/gameLogic.js'
import { getLegalMovesForPiece } from '../../features/game/utils/moveUtils.js'
import { formatClockTime, DEFAULT_TIME_CONTROL } from '../../features/game/utils/timeUtils.js'
import { getTurnAtIndex } from '../../features/game/utils/historyUtils.js'
import PlayerCard from './sections/PlayerCard'
import GameHistoryPanel from './sections/GameHistoryPanel'
import MatchActions from './sections/MatchActions'
import UndoRedoControls from './sections/UndoRedoControls'
import MatchStatus from './sections/MatchStatus'
import GameOverModal from './sections/GameOverModal'
import AiTurnStatus from './sections/AiTurnStatus'
import { useAiOpponent } from '../../features/ai/hooks/useAiOpponent'
import { AI_LEVELS } from '../../features/ai/engine/levels.js'
import { useGameSounds } from '../../features/sound/useGameSounds'
import { selectArrowsEnabled } from '../../store/slices/settingsSlice'
import LogoutConfirmModal from '../../components/ui/LogoutConfirmModal'
import MatchInfoBar from './sections/MatchInfoBar'

const RED_NAME = 'Bạn (Đỏ)'
const BLACK_NAME = 'Đại sư Lý'

// `onlineGame` is undefined for the local/offline board (default — both
// sides playable from one screen, opponent is the built-in placeholder
// name). When provided as { yourColor, roomId, moveHistory, matchResult,
// timerState, messages, timeControl, onLeave }, this same component becomes the online match
// view: only your own color's pieces are selectable on your turn, the cards
// read "Bạn" / "Đối thủ", every locally-committed move is relayed to the
// opponent through the server (useOnlineGame) while the opponent's moves
// are applied back in via applyRemoteMove, and — for a resumed match after
// a reconnect — moveHistory/matchResult/timerState/messages seed
// useGame/useTimer/useChat instead of starting fresh. The parent is
// expected to change this component's `key` whenever it hands down a new
// restored snapshot, so these seed values are only ever consulted at mount.
//
// `aiGame` ({ playerColor, levelId }) turns the local board into a game
// against the bot instead: you play `playerColor`, useAiOpponent plays the
// other side through the same applyRemoteMove path an online opponent's
// moves take. Nothing about it touches the server — no Elo, no history,
// and no clock (untimed).
export function ChessGame({ onlineGame, aiGame }) {
  const navigate = useNavigate()
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
    externalResult,
  } = useGame({ initialMoveHistory: onlineGame?.moveHistory, initialMatchResult: onlineGame?.matchResult })

  // Move / capture / check / game-end sounds for every new move, whoever
  // made it (follows the "Âm thanh" setting) — see useGameSounds.
  useGameSounds({ moveHistory, isGameOver, externalResult })
  const arrowsEnabled = useSelector(selectArrowsEnabled)

  const isOnline = Boolean(onlineGame && onlineGame.yourColor)
  const isAi = !isOnline && Boolean(aiGame)

  // Online: the room's time control (picked when it was created — see
  // TimeControlPicker); vs the bot: no clock at all; local: the default.
  const timeControl = isAi ? null : isOnline ? (onlineGame.timeControl ?? DEFAULT_TIME_CONTROL) : DEFAULT_TIME_CONTROL
  // Online, the clock follows the live game, not whichever earlier move is
  // being looked at in Move History — browsing back must not hand the clock
  // (or an increment) to the other side. Locally, going back is a real
  // takeback, so the clock follows the displayed position as before.
  const clockTurn = isOnline ? getTurnAtIndex(moveHistory, moveHistory.length - 1) : turn

  const handleTimeUp = useCallback((side, reason) => endGameByTimeout(side, reason), [endGameByTimeout])
  const {
    red: redTime,
    black: blackTime,
    untimed,
    resetTimer,
  } = useTimer({
    turn: clockTurn,
    isGameOver,
    onTimeUp: handleTimeUp,
    timeControl,
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

  const { thinking: botThinking } = useAiOpponent({
    enabled: isAi,
    botColor: isAi && aiGame.playerColor === 'red' ? 'black' : 'red',
    levelId: aiGame?.levelId,
    pieces,
    turn,
    moveHistory,
    isGameOver,
    isViewingHistory,
    onMove: applyRemoteMove,
  })

  // Conceding to the bot is purely local: the same game-over path a clock
  // timeout uses, with you as the losing side.
  const resignToBot = useCallback(() => {
    if (aiGame) endGameByTimeout(aiGame.playerColor, GAME_STATUS.RESIGN)
  }, [aiGame, endGameByTimeout])
  const handleGameOver = useCallback((result) => endGameByTimeout(result.loser, result.status), [endGameByTimeout])
  const {
    sendMove,
    error: moveError,
    reportGameOver,
    requestPlayAgain,
    respondPlayAgain,
    playAgainRequest,
    resign,
    drawOffer,
    offerDraw,
    respondDraw,
    ratingUpdate,
  } = useOnlineGame({
    enabled: isOnline,
    onOpponentMove: applyRemoteMove,
    onMoveRejected: undo,
    onGameOver: handleGameOver,
  })

  // This client's own side of the server's Elo/stats update, once it
  // arrives — null until then (see useOnlineGame's ratingUpdate) or for a
  // non-persisted (guest) match. Syncs straight into Redux/localStorage via
  // updateUser (the same path Edit Profile already uses) so Header/Sidebar/
  // Profile reflect the new rating immediately, without a logout/login or
  // manual refresh — the effect only fires once per actual update thanks to
  // the ratingUpdate.gameId dependency.
  const { user, updateUser } = useAuth()
  const myRatingUpdate = isOnline && ratingUpdate ? ratingUpdate[onlineGame.yourColor] : null
  useEffect(() => {
    if (!myRatingUpdate) return
    updateUser({
      rating: myRatingUpdate.rating.after,
      wins: myRatingUpdate.wins,
      losses: myRatingUpdate.losses,
      draws: myRatingUpdate.draws,
    })
    // updateUser intentionally excluded — it closes over `user`/`token` and
    // would otherwise re-fire this effect on every unrelated user-object
    // change; this must only re-run when a genuinely new rating update
    // arrives for this match.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRatingUpdate])

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

  // When this client's clock display hits zero, nudge the server so it
  // checks its own clock right away. Only timeouts need this: the server
  // decides checkmate/stalemate itself while processing the move, and also
  // ends a timed-out turn on its own timer — this just makes it land
  // sooner. Guarded to fire exactly once per game-over instance.
  const reportedGameOverRef = useRef(false)
  useEffect(() => {
    if (!isOnline || !isGameOver) {
      reportedGameOverRef.current = false
      return
    }
    const isTimeout = status === GAME_STATUS.TIMEOUT_MOVE || status === GAME_STATUS.TIMEOUT_GAME
    if (reportedGameOverRef.current || !isTimeout) return
    reportedGameOverRef.current = true
    reportGameOver()
  }, [isOnline, isGameOver, status, reportGameOver])

  // Leaving a game in progress (the sidebar, the top bar, a notification,
  // the browser's back button — any move to another page) asks first. An
  // online game is lost by leaving it: confirming resigns, then leaves the
  // room (onlineGame.onLeave), so the result and Elo are settled like any
  // resignation. Vs the bot, the game is simply dropped. A finished game
  // never asks.
  const guardActive = (isOnline || isAi) && !isGameOver
  const shouldBlock = useCallback(
    ({ currentLocation, nextLocation }) => guardActive && currentLocation.pathname !== nextLocation.pathname,
    [guardActive]
  )
  const leaveBlocker = useBlocker(shouldBlock)
  const confirmLeave = () => {
    if (isOnline && !isGameOver) {
      resign()
      onlineGame.onLeave?.()
    }
    leaveBlocker.proceed?.()
  }

  const botName = isAi ? `Máy · ${AI_LEVELS[aiGame.levelId]?.label ?? ''}` : null
  const nameFor = (color) => {
    if (onlineGame) return onlineGame.yourColor === color ? 'Bạn' : 'Đối thủ'
    if (isAi) return aiGame.playerColor === color ? 'Bạn' : botName
    return color === 'red' ? RED_NAME : BLACK_NAME
  }
  const redName = nameFor('red')
  const blackName = nameFor('black')

  // Real rating for whichever color a PlayerCard represents — never the old
  // hard-coded 2450/2410. This client's own side always reads straight from
  // auth state: it's already the authoritative value (and updateUser above
  // keeps it current the instant a match here ends, so it never goes stale
  // mid-session). There's no equivalent local source for the opponent, so
  // that side prefers the server's post-game Elo update once the match
  // ends (ratingUpdate), falls back to the pre-game snapshot the server
  // sent when the match started (onlineGame.playerRatings — see
  // room.js's attachPlayerRatings), and is left `undefined` — PlayerCard's
  // own loading/fallback display, never a fake number — if neither has
  // arrived yet, e.g. a guest opponent with no account to look up, or
  // local/offline play against the built-in placeholder.
  const ratingForColor = (color) => {
    // Vs the bot: show your own (unchanged — bot games are unrated) rating;
    // the bot has none.
    if (isAi) return color === aiGame.playerColor ? user?.rating : undefined
    if (!isOnline) return color === 'red' ? user?.rating : undefined
    if (color === onlineGame.yourColor) return user?.rating
    const opponentUpdate = ratingUpdate ? ratingUpdate[color] : null
    if (opponentUpdate) return opponentUpdate.rating.after
    return onlineGame.playerRatings ? onlineGame.playerRatings[color] ?? undefined : undefined
  }

  // Same idea as ratingForColor, but for the account id PlayerCard links to
  // (see room.js's toGameStarted). Own side always reads straight from auth
  // state; the opponent side reads whatever the server resolved for this
  // match (null for a guest, undefined before it's known — either way
  // PlayerCard just renders without a link).
  const userIdForColor = (color) => {
    if (isAi) return color === aiGame.playerColor ? user?.id : undefined
    if (!isOnline) return undefined
    if (color === onlineGame.yourColor) return user?.id
    return onlineGame.opponentUserId ?? undefined
  }

  // Online: the server already told each client whose color it is — a
  // player is only allowed to act on their own turn, and only while
  // looking at the live position (not browsing history via undo/redo or
  // Move History — acting from there would silently branch this client's
  // history away from the server's, so it's blocked here rather than
  // needing to disable those controls separately). Local/offline play is
  // untouched either way.
  //
  // Vs the bot: only your own pieces, only on your turn — never while the
  // bot is thinking. Moving from an earlier position you browsed back to
  // (your turn there) is allowed: it replaces what followed, i.e. a takeback,
  // and the bot answers from the new position.
  const handleSquareClick = isOnline
    ? (col, row) => {
        if (!isViewingHistory && turn === onlineGame.yourColor) selectSquare(col, row)
      }
    : isAi
      ? (col, row) => {
          if (!botThinking && turn === aiGame.playerColor) selectSquare(col, row)
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
      // Asks the server for a rematch in this same room — it only actually
      // resets the shared match (board/history/timer/result, same colors)
      // and broadcasts a fresh game_started once the opponent agrees too
      // (see playAgainRequest/GameOverModal below), which is what remounts
      // this component with clean state (the `key` the parent sets from
      // useRoom's restoreVersion). Resetting only this client's local state
      // here would desync it from the opponent's realtime-synced copy, so
      // this never touches resetGame.
      requestPlayAgain()
      return
    }
    resetGame()
    resetTimer()
    setModalDismissed(false)
  }

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

  // Your own side always sits at the bottom — board and player cards alike —
  // like every Xiangqi/chess site. Local play keeps red at the bottom.
  const bottomColor = isOnline ? onlineGame.yourColor : isAi ? aiGame.playerColor : 'red'
  const topColor = bottomColor === 'red' ? 'black' : 'red'

  // Positional props (`online` dot for the top card, accent bar for the
  // bottom one) stay with the position, not the color.
  const renderPlayerCard = (color, positionProps) => {
    const time = color === 'red' ? redTime : blackTime
    return (
      <PlayerCard
        name={color === 'red' ? redName : blackName}
        elo={ratingForColor(color)}
        userId={userIdForColor(color)}
        side={color}
        moveTime={untimed ? undefined : formatClockTime(time.moveTime)}
        gameTime={untimed ? undefined : formatClockTime(time.gameTime)}
        clockActive={!isGameOver && clockTurn === color}
        {...positionProps}
      />
    )
  }

  return (
    <div className="w-full max-w-container-max mx-auto flex flex-col xl:flex-row gap-gutter justify-center">
      {leaveBlocker.state === 'blocked' && (
        <LogoutConfirmModal
          message={isOnline ? 'Bạn có muốn thoát khỏi trận đấu không?' : 'Bạn có muốn thoát khỏi ván đấu với máy không?'}
          detail={
            isOnline
              ? 'Trận đấu đang diễn ra thoát bây giờ bạn sẽ bị xử thua.'
              : 'Ván đang đánh sẽ không được lưu.'
          }
          confirmLabel={isOnline ? 'Thoát và chịu thua' : 'Thoát'}
          cancelLabel="Ở lại"
          onConfirm={confirmLeave}
          onCancel={() => leaveBlocker.reset?.()}
        />
      )}

      {isGameOver && !modalDismissed && (
        <GameOverModal
          winner={winner}
          status={status}
          redName={redName}
          blackName={blackName}
          youWon={isOnline ? onlineGame.yourColor === winner : isAi ? aiGame.playerColor === winner : undefined}
          onClose={() => setModalDismissed(true)}
          onPlayAgain={handlePlayAgain}
          onViewReplay={isOnline && onlineGame.dbGameId ? () => navigate(`/replay/${onlineGame.dbGameId}`) : undefined}
          playAgainRequest={isOnline ? playAgainRequest : undefined}
          onRespondPlayAgain={isOnline ? respondPlayAgain : undefined}
          playAgainError={isOnline ? moveError : undefined}
          ratingChange={myRatingUpdate ? myRatingUpdate.rating.change : undefined}
          ratingAfter={myRatingUpdate ? myRatingUpdate.rating.after : undefined}
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
        {isAi && !isGameOver && !isViewingHistory && <AiTurnStatus thinking={botThinking} botName={botName} />}
        {/* Once the game is over the pieces stop responding (board-readonly)
            but the board can still be drawn on while looking back at it. */}
        <div className={`w-full ${isGameOver ? 'opacity-60 board-readonly' : ''}`}>
          <ChessBoard
            pieces={pieces}
            selectedId={selectedId}
            turn={turn}
            legalMoves={legalMoves}
            onSquareClick={handleSquareClick}
            flipped={bottomColor === 'black'}
            lastMove={currentMoveIndex >= 0 ? moveHistory[currentMoveIndex] : null}
            drawingEnabled={arrowsEnabled}
          />
        </div>
        <div className="w-full mt-3">
          <MatchActions
            canResign={(isOnline || isAi) && !isGameOver}
            onResign={isOnline ? resign : isAi ? resignToBot : undefined}
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
        {isOnline && <MatchInfoBar timeControl={timeControl} spectators={onlineGame.spectators} />}
        {renderPlayerCard(topColor, { online: true })}
        <GameHistoryPanel
          moveHistory={moveHistory}
          currentMoveIndex={currentMoveIndex}
          onSelectMove={goToMove}
          chat={isOnline ? { messages: chatMessages, unreadCount, sendMessage: sendChatMessage, markRead: markChatRead } : null}
        />
        {renderPlayerCard(bottomColor, { accentClassName: 'border-b-4 border-b-error' })}
        <UndoRedoControls canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo} />
      </div>
    </div>
  )
}

export default ChessGame
