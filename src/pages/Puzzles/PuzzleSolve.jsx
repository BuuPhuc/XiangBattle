import { Link, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import Icon from '../../components/ui/Icon'
import Button from '../../components/ui/Button'
import ChessBoard from '../../components/game/ChessBoard'
import { getPuzzle, nextPuzzleId, PUZZLES } from '../../features/puzzles/data/puzzles'
import { SIDE_LABEL } from '../../features/puzzles/engine/puzzle'
import { usePuzzleGame, PHASE } from '../../features/puzzles/hooks/usePuzzleGame'
import { selectPuzzleProgress } from '../../store/slices/puzzlesSlice'
import { selectArrowsEnabled } from '../../store/slices/settingsSlice'
import PuzzleStatus from './sections/PuzzleStatus'

// The three controls share a row and grow to fill it, but never break a
// label over several lines; on a narrow panel they wrap as whole buttons.
const CONTROL_CLASS = 'flex-1 whitespace-nowrap gap-1.5 px-3 disabled:opacity-40 disabled:hover:scale-100'

const MESSAGE_TONE = {
  info: 'bg-surface-container border-outline-variant/40 text-on-surface',
  success: 'bg-secondary/10 border-secondary/40 text-secondary',
  error: 'bg-error/10 border-error/30 text-error',
}

function turnText(game) {
  switch (game.phase) {
    case PHASE.CHECKING:
      return 'Đang kiểm tra nước đi…'
    case PHASE.REPLY:
      return 'Đối phương đang chống đỡ…'
    case PHASE.WRONG:
      return 'Nước đi sẽ được trả lại…'
    case PHASE.SOLVED:
      return 'Đã chiếu bí!'
    case PHASE.DEMO:
      return 'Đang xem lời giải…'
    case PHASE.DEMO_DONE:
      return 'Đã xem xong lời giải'
    default:
      return `Lượt của bạn (${SIDE_LABEL[game.attacker]}) — còn ${game.remaining} nước`
  }
}

// One puzzle's board and controls. Keyed by puzzle id (see PuzzleSolve), so
// moving to another puzzle always starts a fresh attempt.
function PuzzleBoard({ puzzle }) {
  const game = usePuzzleGame(puzzle)
  const arrowsEnabled = useSelector(selectArrowsEnabled)
  const progress = useSelector(selectPuzzleProgress)
  const number = PUZZLES.filter((p) => p.moves === puzzle.moves).findIndex((p) => p.id === puzzle.id) + 1
  const busy = game.phase !== PHASE.PLAYER

  return (
    <div className="w-full max-w-container-max mx-auto flex flex-col xl:flex-row gap-gutter justify-center">
      <div className="flex-grow flex flex-col items-center order-1 w-full xl:max-w-[780px]">
        <div className="w-full">
          <ChessBoard
            pieces={game.pieces}
            selectedId={game.selectedId}
            turn={game.turn}
            legalMoves={game.legalMoves}
            onSquareClick={game.selectSquare}
            flipped={puzzle.toMove === 'black'}
            lastMove={game.lastMove}
            drawingEnabled={arrowsEnabled}
          />
        </div>
      </div>

      <aside className="w-full xl:w-96 flex flex-col gap-4 order-2" aria-label="Thế cờ">
        <Link to="/puzzles" className="inline-flex items-center gap-1 font-label-md text-label-md text-primary hover:underline">
          <Icon name="arrow_back" className="text-base" />
          Danh sách cờ thế
        </Link>

        <div className="glass-panel border border-gold-shimmer/30 rounded-xl p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-label-sm text-label-sm text-on-surface-variant">Chiếu bí {puzzle.moves} nước · #{number}</p>
              <h1 className="font-headline-sm text-headline-sm text-on-surface">{puzzle.title}</h1>
            </div>
            <PuzzleStatus entry={progress[puzzle.id]} />
          </div>
          <p className="font-body-md text-body-md text-on-surface" data-testid="puzzle-task">
            <strong>{SIDE_LABEL[puzzle.toMove]} đi trước</strong>, chiếu bí trong {puzzle.moves} nước.
          </p>
          <p className="font-label-md text-label-md text-on-surface-variant" data-testid="puzzle-turn" aria-live="polite">
            {turnText(game)}
          </p>
        </div>

        <div className="min-h-16" aria-live="polite">
          {game.message && (
            <div className={`px-4 py-3 rounded-lg border font-body-sm text-body-sm ${MESSAGE_TONE[game.message.tone]}`} data-testid="puzzle-message">
              {game.message.text}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline-sm" size="sm" onClick={game.hint} disabled={busy} className={CONTROL_CLASS}>
            <Icon name="lightbulb" className="text-base" /> Gợi ý
          </Button>
          <Button
            variant="outline-sm"
            size="sm"
            onClick={game.showSolution}
            disabled={game.phase === PHASE.DEMO || game.phase === PHASE.CHECKING}
            className={CONTROL_CLASS}
          >
            <Icon name="visibility" className="text-base" /> Xem lời giải
          </Button>
          <Button variant="outline-sm" size="sm" onClick={game.reset} className={CONTROL_CLASS}>
            <Icon name="restart_alt" className="text-base" /> Làm lại
          </Button>
        </div>

        <Button as={Link} to={`/puzzles/${nextPuzzleId(puzzle.id)}`} variant={game.phase === PHASE.SOLVED ? 'primary' : 'outline'}>
          Thế tiếp theo
          <Icon name="arrow_forward" className="text-base" />
        </Button>
      </aside>
    </div>
  )
}

export function PuzzleSolve() {
  const { puzzleId } = useParams()
  const puzzle = getPuzzle(puzzleId)

  if (!puzzle) {
    return (
      <div className="max-w-xl mx-auto py-24 px-4 text-center space-y-4">
        <Icon name="extension_off" className="text-5xl text-on-surface-variant/50 block" />
        <p className="font-body-md text-body-md text-on-surface-variant">Không tìm thấy thế cờ này.</p>
        <Button as={Link} to="/puzzles" variant="outline">
          Về danh sách cờ thế
        </Button>
      </div>
    )
  }

  return <PuzzleBoard key={puzzle.id} puzzle={puzzle} />
}

export default PuzzleSolve
