import { useState } from 'react'
import Icon from '../../components/ui/Icon'
import Button from '../../components/ui/Button'
import useRoom from '../../features/room/hooks/useRoom'
import ChessGame from '../ChessGame/ChessGame'

const COLOR_LABEL = { red: 'Đỏ', black: 'Đen' }

// Room + online match entry point: create/join a room, wait for the second
// seat, then — the moment the server assigns colors and starts the match —
// render the same ChessGame board used for local play, parameterized with
// this client's color. On mount this also always tries to resume a
// previous session first (see useRoom's rejoin handshake), so a refresh
// mid-match lands back on the board instead of this chooser.
export function Room() {
  const {
    room,
    you,
    opponent,
    currentTurn,
    moveHistory,
    matchResult,
    timerState,
    opponentConnected,
    error,
    notice,
    pending,
    rejoining,
    restoreVersion,
    createRoom,
    joinRoom,
    leaveRoom,
  } = useRoom()
  const [joinCode, setJoinCode] = useState('')

  const handleJoinSubmit = (event) => {
    event.preventDefault()
    if (!joinCode.trim()) return
    joinRoom(joinCode)
  }

  if (rejoining) {
    return (
      <div className="max-w-xl mx-auto py-24 px-4 text-center space-y-3">
        <span className="w-3 h-3 rounded-full bg-secondary animate-pulse inline-block" />
        <p className="font-body-md text-body-md text-on-surface-variant">Đang khôi phục trận đấu...</p>
      </div>
    )
  }

  if (room && room.status === 'playing' && you?.color) {
    return (
      <div className="space-y-4">
        <div className="max-w-xl mx-auto px-4 text-center space-y-2">
          <div className="px-4 py-2 rounded-lg bg-secondary/10 border border-secondary/30 text-secondary font-label-md text-label-md">
            Trận đấu — Phòng {room.roomId} · Bạn: {COLOR_LABEL[you.color]} · Đối thủ: {COLOR_LABEL[opponent?.color]} · Lượt
            đi: {COLOR_LABEL[currentTurn]}
          </div>
          {!opponentConnected && (
            <div className="px-4 py-2 rounded-lg bg-error/10 border border-error/30 text-error font-label-md text-label-md">
              Đối thủ mất kết nối — đang chờ họ quay lại...
            </div>
          )}
        </div>
        <ChessGame
          key={restoreVersion}
          onlineGame={{
            yourColor: you.color,
            opponentColor: opponent?.color,
            roomId: room.roomId,
            moveHistory,
            matchResult,
            timerState,
          }}
        />
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto py-16 px-4 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Chơi với người khác</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">Tạo phòng mới hoặc tham gia bằng mã phòng.</p>
      </div>

      {notice && (
        <div className="px-4 py-3 rounded-lg bg-secondary/10 border border-secondary/30 text-secondary font-label-md text-label-md text-center">
          {notice}
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-lg bg-error/10 border border-error/30 text-error font-label-md text-label-md text-center">
          {error}
        </div>
      )}

      {!room && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-panel border border-gold-shimmer/30 p-6 rounded-xl flex flex-col items-center gap-4 text-center">
            <Icon name="add_circle" className="text-4xl text-primary" />
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Tạo phòng</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Tạo phòng mới và nhận mã để mời đối thủ.</p>
            <Button onClick={createRoom} disabled={pending} className="w-full disabled:opacity-50">
              {pending ? 'Đang tạo...' : 'Tạo phòng'}
            </Button>
          </div>

          <form
            onSubmit={handleJoinSubmit}
            className="glass-panel border border-gold-shimmer/30 p-6 rounded-xl flex flex-col items-center gap-4 text-center"
          >
            <Icon name="login" className="text-4xl text-primary" />
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Tham gia phòng</h2>
            <input
              type="text"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              placeholder="Mã phòng"
              maxLength={6}
              className="w-full text-center tracking-[0.3em] uppercase font-label-lg text-label-lg px-4 py-2 rounded-lg border border-outline-variant bg-surface-container focus:outline-none focus:border-primary"
            />
            <Button type="submit" variant="outline" disabled={pending || !joinCode.trim()} className="w-full disabled:opacity-50">
              {pending ? 'Đang tham gia...' : 'Tham gia'}
            </Button>
          </form>
        </div>
      )}

      {room && room.status === 'waiting' && (
        <div className="glass-panel border border-gold-shimmer/30 p-8 rounded-xl flex flex-col items-center gap-4 text-center">
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Mã phòng</span>
          <span className="font-headline-lg text-headline-lg text-primary tracking-[0.3em]">{room.roomId}</span>
          <p className="font-body-md text-body-md text-on-surface-variant flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            Đang chờ đối thủ...
          </p>
          <Button onClick={leaveRoom} variant="outline" size="sm">
            Hủy phòng
          </Button>
        </div>
      )}
    </div>
  )
}

export default Room
