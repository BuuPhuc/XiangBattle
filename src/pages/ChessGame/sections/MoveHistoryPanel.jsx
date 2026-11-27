import { useState } from 'react'
import Button from '../../../components/ui/Button'
import Icon from '../../../components/ui/Icon'
import { cn } from '../../../components/utils/cn'
import { groupMovesIntoRows } from '../../../features/game/utils/historyUtils'

const PAGE_SIZE = 10

// `annotation` ({ symbol, label, className } — Phân tích ván's ?! / ? / ??,
// see features/analysis/gradeStyles.js) is shown right after the move.
function MoveCell({ move, index, currentMoveIndex, onSelectMove, placeholder, annotation }) {
  if (!move) {
    return placeholder ? <span className="animate-pulse text-on-surface-variant">...</span> : null
  }

  const isViewed = index === currentMoveIndex

  return (
    <button
      type="button"
      onClick={() => onSelectMove(index)}
      className={cn(
        'font-medium rounded px-1.5 py-0.5 -mx-1.5 transition-colors hover:bg-primary/10',
        isViewed ? 'bg-primary/15 text-primary font-bold ring-1 ring-primary/40' : ''
      )}
      aria-current={isViewed ? 'true' : undefined}
    >
      {move.notation}
      {annotation && (
        <span className={cn('ml-0.5 font-bold', annotation.className)} title={annotation.label} data-grade={annotation.symbol}>
          {annotation.symbol}
        </span>
      )}
    </button>
  )
}

// `annotations` (optional) — one entry per move index, null for none; only
// the Replay page passes it, once a game has been analysed.
export function MoveHistoryPanel({ moveHistory, currentMoveIndex, onSelectMove, annotations }) {
  const rows = groupMovesIntoRows(moveHistory)
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  // Opens on the newest page, and jumps back to it whenever the page count
  // changes (a move added or removed a page, live or branched), so live play
  // always stays in view; otherwise the page the user picked stays. Done
  // while rendering — React's "adjust state when a prop changes" — rather
  // than in an effect, which would render once more with the old page.
  const [page, setPage] = useState(totalPages)
  const [pageCountSeen, setPageCountSeen] = useState(totalPages)
  if (pageCountSeen !== totalPages) {
    setPageCountSeen(totalPages)
    setPage(totalPages)
  }

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const isLastRow = (row) => row.number === rows.length

  return (
    <div className="flex flex-col flex-grow min-h-0">
      {rows.length === 0 ? (
        <div className="flex-grow flex items-center justify-center p-4">
          <p className="font-label-sm text-label-sm text-on-surface-variant text-center">Chưa có nước đi nào</p>
        </div>
      ) : (
        <div className="p-2 overflow-y-auto move-history flex-grow">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-label-sm text-on-surface-variant border-b border-surface-variant">
                <th className="py-2 px-4 font-medium">#</th>
                <th className="py-2 px-4 font-medium text-error">Đỏ</th>
                <th className="py-2 px-4 font-medium">Đen</th>
              </tr>
            </thead>
            <tbody className="font-body-md text-body-md">
              {pageRows.map((row) => (
                <tr
                  key={row.number}
                  className="border-b border-surface-container-high hover:bg-surface-bright transition-colors"
                >
                  <td className="py-2 px-4 text-on-surface-variant">{row.number}</td>
                  <td className="py-2 px-4">
                    <MoveCell
                      move={row.red}
                      index={row.redIndex}
                      currentMoveIndex={currentMoveIndex}
                      onSelectMove={onSelectMove}
                      annotation={annotations?.[row.redIndex]}
                    />
                  </td>
                  <td className="py-2 px-4 text-wood-dark">
                    <MoveCell
                      move={row.black}
                      index={row.blackIndex}
                      currentMoveIndex={currentMoveIndex}
                      onSelectMove={onSelectMove}
                      placeholder={isLastRow(row)}
                      annotation={annotations?.[row.blackIndex]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 p-2 border-t border-outline-variant/30">
          <Button
            variant="icon"
            size="sm"
            onClick={() => setPage(1)}
            disabled={page === 1}
            aria-label="Trang đầu"
          >
            <Icon name="first_page" size="md" />
          </Button>
          <Button
            variant="icon"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="Trang trước"
          >
            <Icon name="chevron_left" size="md" />
          </Button>
          <span className="font-label-sm text-label-sm text-on-surface-variant px-3">{page}</span>
          <Button
            variant="icon"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            aria-label="Trang sau"
          >
            <Icon name="chevron_right" size="md" />
          </Button>
          <Button
            variant="icon"
            size="sm"
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            aria-label="Trang cuối"
          >
            <Icon name="last_page" size="md" />
          </Button>
        </div>
      )}
    </div>
  )
}

export default MoveHistoryPanel
