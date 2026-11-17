import Icon from '../../../components/ui/Icon'
import Button from '../../../components/ui/Button'
import { cn } from '../../../components/utils/cn'
import { GRADES, formatScore } from '../../../features/analysis/analysis.js'
import { gradeStyle } from '../../../features/analysis/gradeStyles.js'

const GRADE_ORDER = ['inaccuracy', 'mistake', 'blunder']

// Phân tích ván on the Replay page: the start button, progress while the bot
// works through the game, then — for the position shown — the score, what
// the bot thinks of the move that led to it and what it would play next,
// and each side's count of inaccuracies / mistakes / blunders.
//   analysis   — useGameAnalysis's { status, progress, error, start, cancel }
//   evaluation — the shown position's evaluation (or undefined)
//   shownMove  — { number, side, notation, grade } for the move that led to
//                the shown position (grade: analysis.js's gradeMove), or null
//   nextBest   — { notation } the bot's move in the shown position, or null
//   summary    — analysis.js's summarize(), once done
export function AnalysisPanel({ analysis, evaluation, shownMove, nextBest, summary }) {
  const { status, progress, error, start, cancel } = analysis
  const running = status === 'running'
  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <section className="glass-panel border border-gold-shimmer/30 rounded-xl p-4 space-y-3" data-testid="analysis-panel">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-label-md text-label-md text-on-surface flex items-center gap-2">
          <Icon name="query_stats" className="text-[18px]" />
          Phân tích ván
        </h4>
        {evaluation && (
          <span className="font-label-md text-label-md font-bold tabular-nums text-primary" data-testid="analysis-score">
            {formatScore(evaluation)}
          </span>
        )}
      </div>

      {status === 'idle' && (
        <div className="space-y-2">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Máy sẽ chấm từng nước của ván này và đánh dấu nước không chính xác, sai lầm, nước hớ. Mất khoảng{' '}
            {Math.max(1, Math.round(progress.total / 60))} phút.
          </p>
          <Button onClick={start} className="w-full">
            <Icon name="query_stats" className="text-[18px]" />
            Phân tích ván
          </Button>
        </div>
      )}

      {running && (
        <div className="space-y-2">
          <div className="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant">
            <span>
              Đang phân tích… {progress.done}/{progress.total}
            </span>
            <button type="button" onClick={cancel} className="text-primary hover:underline">
              Dừng
            </button>
          </div>
          <div
            className="h-2 rounded-full bg-surface-container-high overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label="Tiến độ phân tích"
          >
            <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-2">
          <p className="font-body-sm text-body-sm text-error">{error}</p>
          <Button variant="outline" onClick={start} className="w-full">
            Thử lại
          </Button>
        </div>
      )}

      {(running || status === 'done') && (
        <div className="space-y-1.5 font-body-sm text-body-sm" data-testid="analysis-current">
          {shownMove && <ShownMove move={shownMove} />}
          {nextBest && (
            <p className="text-on-surface-variant">
              Máy đề xuất đi tiếp: <strong className="text-[#16803d]">{nextBest.notation}</strong>{' '}
              <span className="text-on-surface-variant/70">(mũi tên xanh)</span>
            </p>
          )}
        </div>
      )}

      {status === 'done' && summary && <Summary summary={summary} />}

      {(running || status === 'done') && (
        <p className="font-label-sm text-label-sm text-on-surface-variant/70">
          Phân tích bằng máy của XiangBattle, nhìn trước khoảng 6 nước — chỉ mang tính tham khảo.
        </p>
      )}
    </section>
  )
}

function ShownMove({ move }) {
  const side = move.side === 'red' ? 'Đỏ' : 'Đen'
  const style = gradeStyle(move.grade?.grade)
  if (!move.grade) {
    return (
      <p className="text-on-surface-variant">
        Nước {move.number} · {side} {move.notation}: đang chấm…
      </p>
    )
  }
  return (
    <p className="text-on-surface" data-testid="analysis-move">
      Nước {move.number} · {side} <strong>{move.notation}</strong>
      {style ? (
        <>
          {' '}
          <span className={cn('font-bold', style.className)}>
            {style.symbol} {style.label}
          </span>
          {move.grade.allowedMate && ' (để đối thủ chiếu bí)'}
          {move.grade.missedMate && !move.grade.allowedMate && ' (bỏ lỡ chiếu bí)'}
          {move.grade.bestNotation && (
            <>
              . Nên đi: <strong>{move.grade.bestNotation}</strong>
            </>
          )}
        </>
      ) : move.grade.loss === 0 ? (
        <span className="text-on-surface-variant"> — nước tốt nhất</span>
      ) : (
        <span className="text-on-surface-variant"> — nước tốt</span>
      )}
    </p>
  )
}

function Summary({ summary }) {
  return (
    <table className="w-full font-label-sm text-label-sm" data-testid="analysis-summary">
      <thead>
        <tr className="text-on-surface-variant">
          <th className="text-left font-medium py-1" />
          <th className="text-center font-medium py-1 text-error">Đỏ</th>
          <th className="text-center font-medium py-1">Đen</th>
        </tr>
      </thead>
      <tbody>
        {GRADE_ORDER.map((grade) => {
          const style = gradeStyle(grade)
          return (
            <tr key={grade} className="border-t border-outline-variant/20">
              <td className="py-1">
                <span className={cn('font-bold mr-1', style.className)}>{style.symbol}</span>
                {GRADES[grade].label}
              </td>
              <td className="py-1 text-center tabular-nums">{summary.red[grade]}</td>
              <td className="py-1 text-center tabular-nums">{summary.black[grade]}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default AnalysisPanel
