import { useState } from 'react'
import Icon from '../../components/ui/Icon'
import Button from '../../components/ui/Button'
import ChessGame from '../ChessGame/ChessGame'
import AiSetup from './sections/AiSetup'
import { AI_LEVELS } from '../../features/ai/engine/levels.js'

function resolveColor(color) {
  if (color === 'random') return Math.random() < 0.5 ? 'red' : 'black'
  return color
}

// "Đối đầu AI": pick a level and colour, then play the bot on the existing
// game screen (ChessGame with `aiGame`). Entirely local — no socket, no
// server, no Elo, no match history.
//
// "Chơi lại" restarts with the same settings (a colour chosen as random is
// re-drawn); "Ván mới" goes back to the setup screen. Both work at any time,
// mid-game included. Restarting remounts ChessGame (new `key`), which also
// cancels a move the bot may still be thinking about.
export function AiGame() {
  const [setup, setSetup] = useState(null) // { levelId, color } as chosen ('random' kept)
  const [game, setGame] = useState(null) // { levelId, playerColor, key }

  const start = (choice) => {
    setSetup(choice)
    setGame({ levelId: choice.levelId, playerColor: resolveColor(choice.color), key: Date.now() })
  }

  if (!game) {
    return <AiSetup initialLevelId={setup?.levelId} initialColor={setup?.color} onStart={start} />
  }

  const level = AI_LEVELS[game.levelId]

  return (
    <div className="space-y-3">
      <div className="w-full max-w-container-max mx-auto glass-panel border border-gold-shimmer/30 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 font-label-md text-label-md text-on-surface">
          <Icon name="smart_toy" className="text-[20px] text-on-surface-variant" />
          <span>
            Đối đầu máy · <strong>{level.label}</strong> · Bạn cầm {game.playerColor === 'red' ? 'Đỏ' : 'Đen'}
          </span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">(không tính Elo)</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline-sm" size="sm" onClick={() => start(setup)}>
            <Icon name="refresh" className="text-[18px]" />
            Chơi lại
          </Button>
          <Button variant="outline-sm" size="sm" onClick={() => setGame(null)}>
            <Icon name="tune" className="text-[18px]" />
            Ván mới
          </Button>
        </div>
      </div>

      <ChessGame key={game.key} aiGame={{ playerColor: game.playerColor, levelId: game.levelId }} />
    </div>
  )
}

export default AiGame
