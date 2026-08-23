import Piece from './Piece'
import Square from './Square'

const CROSS_MARK_POINTS = [
  { left: 12.5, top: 22.22 },
  { left: 87.5, top: 22.22 },
  { left: 12.5, top: 77.77 },
  { left: 87.5, top: 77.77 },
]
const CROSS_MARK_CORNERS = ['tl', 'tr', 'bl', 'br']

const ALL_SQUARES = Array.from({ length: 10 }, (_, row) =>
  Array.from({ length: 9 }, (_, col) => ({ col, row }))
).flat()

export function ChessBoard({ pieces, selectedId, onSquareClick }) {
  return (
    <div className="xiangqi-board-container relative w-full max-w-[600px] mx-auto">
      <div className="board-coords coords-top">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((label) => (
          <span key={`top-${label}`}>{label}</span>
        ))}
      </div>

      <div className="xiangqi-board-wrapper">
        <div className="board-inner">
          <div className="grid-lines">
            <div className="grid-half">
              {Array.from({ length: 32 }, (_, i) => (
                <div key={`upper-${i}`} className="grid-cell" />
              ))}
            </div>
            <div className="river-area">
              <span className="river-text">楚 河</span>
              <span className="river-domain">Xiangqi Master</span>
              <span className="river-text">漢 界</span>
            </div>
            <div className="grid-half">
              {Array.from({ length: 32 }, (_, i) => (
                <div key={`lower-${i}`} className="grid-cell" />
              ))}
            </div>
          </div>

          <div className="palace-lines top">
            <div className="palace-line line-1" />
            <div className="palace-line line-2" />
          </div>
          <div className="palace-lines bottom">
            <div className="palace-line line-1" />
            <div className="palace-line line-2" />
          </div>

          {CROSS_MARK_POINTS.map((point) =>
            CROSS_MARK_CORNERS.map((corner) => (
              <div
                key={`${point.left}-${point.top}-${corner}`}
                className={`cross-mark ${corner}`}
                style={{ left: `${point.left}%`, top: `${point.top}%` }}
              />
            ))
          )}

          <div className="absolute inset-0 pointer-events-none">
            {ALL_SQUARES.map(({ col, row }) => (
              <Square key={`sq-${col}-${row}`} col={col} row={row} onClick={() => onSquareClick(col, row)} />
            ))}
          </div>

          <div className="piece-layer">
            {pieces.map((piece) => (
              <Piece
                key={piece.id}
                side={piece.side}
                char={piece.char}
                col={piece.col}
                row={piece.row}
                selected={selectedId === piece.id}
                onSelect={() => onSquareClick(piece.col, piece.row)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="board-coords coords-bottom">
        {['9', '8', '7', '6', '5', '4', '3', '2', '1'].map((label) => (
          <span key={`bottom-${label}`}>{label}</span>
        ))}
      </div>
    </div>
  )
}

export default ChessBoard
