import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import ChessBoard from '../../components/game/ChessBoard'
import Icon from '../../components/ui/Icon'
import useAuth from '../../components/hooks/useAuth'
import { useGame } from '../../features/game/hooks/useGame'
import { useTimer } from '../../features/game/hooks/useTimer'
import { getTurnAtIndex } from '../../features/game/utils/historyUtils.js'
import { formatClockTime } from '../../features/game/utils/timeUtils.js'
import { useGameSounds } from '../../features/sound/useGameSounds'
import { useSpectate } from '../../features/spectate/useSpectate'
import { selectArrowsEnabled } from '../../store/slices/settingsSlice'
import PlayerCard from '../ChessGame/sections/PlayerCard'
import GameHistoryPanel from '../ChessGame/sections/GameHistoryPanel'
import MatchStatus from '../ChessGame/sections/MatchStatus'
import UndoRedoControls from '../ChessGame/sections/UndoRedoControls'
import MatchInfoBar from '../ChessGame/sections/MatchInfoBar'
import { describeSpectatorResult, COLOR_LABEL } from './watchText'

const NO_LEGAL_MOVES = []
const ignore = () => {}

// "Xem ván đang diễn ra" — /watch/:roomId, open to everyone. The board is
// read-only (you can browse back through the moves and draw arrows, never
// move a piece); the clocks run from the server's snapshot; the chat tab is
// the spectators' own ("Khán giả"), which only signed-in viewers can write
// in. Nothing here can reach the players.
export function WatchGame() {
  const { roomId: rawRoomId } = useParams()
  const roomId = (rawRoomId || '').toUpperCase()
  const spectate = useSpectate(roomId)
  const { snapshot, version, notFound } = spectate

  if (notFound) {
    return (
      <WatchMessage
        icon={notFound.code === 'YOU_ARE_PLAYING' ? 'sports_esports' : 'visibility_off'}
        title={notFound.code === 'YOU_ARE_PLAYING' ? 'Bạn đang chơi trong ván này' : 'Ván đấu không còn diễn ra'}
        detail={notFound.code === 'YOU_ARE_PLAYING' ? 'Hãy quay lại bàn cờ của bạn.' : notFound.message}
        action={notFound.code === 'YOU_ARE_PLAYING' ? { to: '/room', label: 'Về bàn cờ' } : { to: '/live', label: 'Xem ván khác' }}
      />
    )
  }

  if (!snapshot) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-on-surface-variant font-label-md text-label-md">
        <Icon name="visibility" className="animate-pulse" />
        Đang mở ván đấu…
      </div>
    )
  }

  if (snapshot.status !== 'playing' && snapshot.moveHistory.length === 0 && !spectate.result) {
    return (
      <WatchMessage
        icon="hourglass_top"
        title="Phòng đang chờ người chơi"
        detail="Ván đấu sẽ hiện ra ngay khi đủ hai người."
        action={{ to: '/live', label: 'Xem ván khác' }}
      />
    )
  }

  return <SpectatorBoard key={version} spectate={spectate} />
}

function WatchMessage({ icon, title, detail, action }) {
  return (
    <div className="max-w-md mx-auto text-center py-20 px-4">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
        <Icon name={icon} className="text-4xl" />
      </div>
      <h1 className="font-headline-md text-headline-md text-on-surface mb-2">{title}</h1>
      {detail && <p className="font-body-md text-body-md text-on-surface-variant mb-6">{detail}</p>}
      {action && (
        <Link
          to={action.to}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:opacity-90"
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}

// Mounted fresh (key={version}) from each snapshot; later moves come in
// through `spectate.moves`, applied one at a time in order.
function SpectatorBoard({ spectate }) {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const arrowsEnabled = useSelector(selectArrowsEnabled)
  const { snapshot, moves, result, players, spectators, connection, playerLeft, closed, dbGameId, ratingUpdate } = spectate

  const {
    pieces,
    turn,
    isGameOver,
    moveHistory,
    currentMoveIndex,
    isViewingHistory,
    goToMove,
    canUndo,
    canRedo,
    undo,
    redo,
    endGameByTimeout,
    applyRemoteMove,
    externalResult,
  } = useGame({ initialMoveHistory: snapshot.moveHistory, initialMatchResult: snapshot.matchResult })

  // The next move not yet on this board — one per render, so each is
  // applied on top of the one before it.
  const nextMove = moves[moveHistory.length - snapshot.moveHistory.length]
  useEffect(() => {
    if (nextMove) applyRemoteMove(nextMove)
  }, [nextMove, applyRemoteMove])

  // The server's verdict (resign, timeout, draw…), applied the same way the
  // players' boards apply it. Only once the board has every move.
  const caughtUp = !nextMove
  useEffect(() => {
    if (result && caughtUp && !externalResult) endGameByTimeout(result.loser, result.status)
  }, [result, caughtUp, externalResult, endGameByTimeout])

  useGameSounds({ moveHistory, isGameOver, externalResult })

  // Clocks: seeded from the snapshot, following the live turn. Running out
  // here decides nothing — the server's result arrives on its own.
  const clockTurn = getTurnAtIndex(moveHistory, moveHistory.length - 1)
  const finished = isGameOver || Boolean(result)
  const { red: redTime, black: blackTime } = useTimer({
    turn: clockTurn,
    isGameOver: finished,
    onTimeUp: ignore,
    timeControl: snapshot.timeControl,
    initialTimes: snapshot.timerState,
  })

  const [flipped, setFlipped] = useState(false)
  const bottomColor = flipped ? 'black' : 'red'
  const topColor = flipped ? 'red' : 'black'

  const seat = (color) => players.find((player) => player.color === color) ?? null
  const nameOf = (color) => seat(color)?.username || `Khách (${COLOR_LABEL[color]})`
  const names = { red: nameOf('red'), black: nameOf('black') }

  const renderPlayerCard = (color) => {
    const player = seat(color)
    const time = color === 'red' ? redTime : blackTime
    const update = ratingUpdate ? ratingUpdate[color] : null
    const offline = player && !connection[color] && !finished
    return (
      <PlayerCard
        name={offline ? `${names[color]} · mất kết nối` : names[color]}
        elo={update ? update.rating.after : (player?.rating ?? undefined)}
        userId={player?.userId ?? undefined}
        side={color}
        moveTime={formatClockTime(time.moveTime)}
        gameTime={formatClockTime(time.gameTime)}
        clockActive={!finished && clockTurn === color}
        online={Boolean(player) && connection[color] && !finished}
      />
    )
  }

  const resultText = describeSpectatorResult(result, names)
  const notice = closed
    ? 'Phòng đã đóng — hai người chơi đã rời đi.'
    : playerLeft && playerLeft !== 'unknown'
      ? `${names[playerLeft]} đã rời phòng.`
      : null

  return (
    <div className="w-full max-w-container-max mx-auto flex flex-col xl:flex-row gap-gutter justify-center">
      <div className="flex-grow flex flex-col items-center order-1 w-full xl:max-w-[780px]">
        <div
          className="w-full mb-3 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary font-label-md text-label-md"
          data-testid="watch-banner"
        >
          <Icon name="visibility" className="text-[18px]" />
          Bạn đang xem ván đấu · {seat('red')?.username || 'Khách'} (Đỏ) vs {seat('black')?.username || 'Khách'} (Đen)
        </div>

        {resultText && (
          <div
            className="w-full mb-3 flex flex-wrap items-center justify-center gap-3 px-4 py-3 rounded-lg border border-gold-shimmer/40 bg-surface-container-low"
            data-testid="watch-result"
          >
            <Icon name="flag" className="text-secondary" />
            <span className="font-label-md text-label-md text-on-surface">Ván đấu kết thúc: {resultText}</span>
            {dbGameId && isAuthenticated && (
              <button
                type="button"
                onClick={() => navigate(`/replay/${dbGameId}`)}
                className="font-label-md text-label-md text-primary hover:underline"
              >
                Xem lại ván đấu
              </button>
            )}
            <Link to="/live" className="font-label-md text-label-md text-primary hover:underline">
              Xem ván khác
            </Link>
          </div>
        )}
        {notice && (
          <div className="w-full mb-3 px-4 py-2 rounded-lg bg-surface-container text-on-surface-variant font-label-md text-label-md text-center">
            {notice}
          </div>
        )}

        {isViewingHistory && (
          <MatchStatus viewedMoveNumber={currentMoveIndex + 1} onReturnToLive={() => goToMove(moveHistory.length - 1)} />
        )}

        <div className={`w-full board-readonly ${finished ? 'opacity-60' : ''}`}>
          <ChessBoard
            pieces={pieces}
            selectedId={null}
            turn={turn}
            legalMoves={NO_LEGAL_MOVES}
            onSquareClick={ignore}
            flipped={flipped}
            lastMove={currentMoveIndex >= 0 ? moveHistory[currentMoveIndex] : null}
            drawingEnabled={arrowsEnabled}
          />
        </div>
        <div className="w-full mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setFlipped((value) => !value)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant/40 text-on-surface-variant hover:text-primary hover:border-primary/40 font-label-md text-label-md transition-colors"
          >
            <Icon name="swap_vert" className="text-[18px]" />
            Lật bàn cờ
          </button>
        </div>
      </div>

      <div className="w-full xl:w-96 flex flex-col gap-3 order-2">
        <MatchInfoBar timeControl={snapshot.timeControl} spectators={spectators} />
        {renderPlayerCard(topColor)}
        <GameHistoryPanel
          moveHistory={moveHistory}
          currentMoveIndex={currentMoveIndex}
          onSelectMove={goToMove}
          chat={{
            label: 'Khán giả',
            icon: 'forum',
            messages: spectate.messages,
            unreadCount: spectate.unreadCount,
            sendMessage: spectate.sendMessage,
            markRead: spectate.markRead,
            error: spectate.chatError,
            readOnlyNotice: isAuthenticated ? null : (
              <>
                <Link to={`/login?next=${encodeURIComponent(`/watch/${snapshot.roomId}`)}`} className="text-primary font-semibold hover:underline">
                  Đăng nhập
                </Link>{' '}
                để trò chuyện cùng khán giả.
              </>
            ),
          }}
        />
        {renderPlayerCard(bottomColor)}
        <UndoRedoControls canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo} />
      </div>
    </div>
  )
}

export default WatchGame
