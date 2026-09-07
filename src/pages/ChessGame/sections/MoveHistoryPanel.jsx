import { useEffect, useState } from 'react'
import Icon from '../../../components/ui/Icon'
import { cn } from '../../../components/utils/cn'
import { groupMovesIntoRows } from '../../../features/game/utils/historyUtils'

const PAGE_SIZE = 10

function MoveCell({ move, index, currentMoveIndex, onSelectMove, placeholder }) {
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
    </button>
  )
}

export function MoveHistoryPanel({ moveHistory, currentMoveIndex, onSelectMove }) {
  const rows = groupMovesIntoRows(moveHistory)
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const [page, setPage] = useState(1)

  // Jump to the newest page whenever the move count changes (a new move was
  // played, live or branched), so live play always stays in view.
  useEffect(() => {
    setPage(totalPages)
  }, [totalPages])

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
                    <MoveCell move={row.red} index={row.redIndex} currentMoveIndex={currentMoveIndex} onSelectMove={onSelectMove} />
                  </td>
                  <td className="py-2 px-4 text-wood-dark">
                    <MoveCell
                      move={row.black}
                      index={row.blackIndex}
                      currentMoveIndex={currentMoveIndex}
                      onSelectMove={onSelectMove}
                      placeholder={isLastRow(row)}
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
          <button
            className="p-1.5 rounded hover:bg-surface-container disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            onClick={() => setPage(1)}
            disabled={page === 1}
            aria-label="Trang đầu"
          >
            <Icon name="first_page" className="text-[18px]" />
          </button>
          <button
            className="p-1.5 rounded hover:bg-surface-container disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="Trang trước"
          >
            <Icon name="chevron_left" className="text-[18px]" />
          </button>
          <span className="font-label-sm text-label-sm text-on-surface-variant px-3">{page}</span>
          <button
            className="p-1.5 rounded hover:bg-surface-container disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            aria-label="Trang sau"
          >
            <Icon name="chevron_right" className="text-[18px]" />
          </button>
          <button
            className="p-1.5 rounded hover:bg-surface-container disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            aria-label="Trang cuối"
          >
            <Icon name="last_page" className="text-[18px]" />
          </button>
        </div>
      )}
    </div>
  )
}

export default MoveHistoryPanel
