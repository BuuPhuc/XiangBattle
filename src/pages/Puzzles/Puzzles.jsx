import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import Icon from '../../components/ui/Icon'
import XiangqiBoard from '../../components/ui/XiangqiBoard'
import { PUZZLES, PUZZLE_LEVELS } from '../../features/puzzles/data/puzzles'
import { buildPuzzlePieces, SIDE_LABEL } from '../../features/puzzles/engine/puzzle'
import { selectPuzzleProgress } from '../../store/slices/puzzlesSlice'
import PuzzleStatus from './sections/PuzzleStatus'

function PuzzleCard({ puzzle, number, entry }) {
  return (
    <Link
      to={`/puzzles/${puzzle.id}`}
      data-testid={`puzzle-card-${puzzle.id}`}
      className="group glass-panel border border-gold-shimmer/30 rounded-xl p-3 flex flex-col gap-2 hover:border-primary/50 hover:-translate-y-0.5 transition-all"
    >
      <XiangqiBoard
        className="w-full rounded-lg"
        pieces={buildPuzzlePieces(puzzle)}
        flipped={puzzle.toMove === 'black'}
        label={`Thế cờ ${number}: ${puzzle.title}`}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-label-md text-label-md text-on-surface truncate">
            #{number} · {puzzle.title}
          </p>
          <p className="font-label-sm text-label-sm text-on-surface-variant">{SIDE_LABEL[puzzle.toMove]} đi trước</p>
        </div>
        <PuzzleStatus entry={entry} />
      </div>
    </Link>
  )
}

// "Cờ thế" — every puzzle, grouped by how many moves the mate takes, with
// this browser's progress (Đã giải / Đã xem lời giải).
export function Puzzles() {
  const progress = useSelector(selectPuzzleProgress)
  const solvedCount = PUZZLES.filter((p) => progress[p.id]?.solved).length

  return (
    <div className="max-w-container-max mx-auto py-10 px-4 space-y-10">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface flex items-center gap-2">
            <Icon name="extension" className="text-primary" />
            Cờ thế
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Tìm cách chiếu bí trong đúng số nước. Máy sẽ chống đỡ bằng nước mạnh nhất.
          </p>
        </div>
        <div className="min-w-56" data-testid="puzzle-progress">
          <p className="font-label-md text-label-md text-on-surface text-right">
            Đã giải {solvedCount} / {PUZZLES.length}
          </p>
          <div className="h-2 rounded-full bg-surface-container-high mt-2 overflow-hidden">
            <div className="h-full bg-secondary rounded-full transition-all" style={{ width: `${(solvedCount / PUZZLES.length) * 100}%` }} />
          </div>
        </div>
      </div>

      {PUZZLE_LEVELS.map((level) => {
        const list = PUZZLES.filter((p) => p.moves === level.moves)
        return (
          <section key={level.moves} className="space-y-4">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">{level.title}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {list.map((puzzle, index) => (
                <PuzzleCard key={puzzle.id} puzzle={puzzle} number={index + 1} entry={progress[puzzle.id]} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export default Puzzles
