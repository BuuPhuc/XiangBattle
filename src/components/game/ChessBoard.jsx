import Piece from './Piece'
import Square from './Square'
import MoveMarker from './MoveMarker'

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

// `turn` and `legalMoves` are purely for UI feedback layered on top of the
// existing engine/game-state — turn already comes from useGame's own turn
// state (never a new state), and legalMoves is whatever the caller derived
// from moveUtils.js's existing getLegalMovesForPiece for the selected piece
// (never re-implemented here). legalMoves entries are `{ col, row, capture }`.
//
// `children` is an optional overlay drawn in the board's own coordinate
// space, above the move markers and below the pieces — how the Academy adds
// its target/hint markers (see AcademyBoard.jsx) without a second board.
// The live game and replay pass nothing, so nothing changes for them.
//
// `flipped` rotates the view 180° so the black side sits at the bottom —
// every player sees their own pieces nearest them. Only what's drawn moves:
// pieces, click targets and markers are placed at the rotated position, but
// onSquareClick always receives the real board coordinates, so the game
// logic never knows the board was turned. The grid itself is symmetric and
// the file labels already read 1→9 from each side's own right, so neither
// changes. (`children` overlays are drawn in unrotated coordinates; nothing
// passes them together with `flipped`.)
export function ChessBoard({ pieces, selectedId, turn, legalMoves = [], onSquareClick, flipped = false, children }) {
  const viewCol = (col) => (flipped ? 8 - col : col)
  const viewRow = (row) => (flipped ? 9 - row : row)

  return (
    // Bounded by three things at once, whichever is smallest: the parent
    // column's own width, an absolute cap, and — the important one — the
    // viewport's actual height, so a shorter window shrinks the board
    // instead of pushing content below the fold and forcing the page to
    // scroll. The buffer constant is this page's measured non-board
    // vertical chrome (just the "Đang xem lịch sử" pill when browsing
    // history, gaps, the compact resign/draw row below the board — now that
    // the old turn banner and the Room status bar are gone, this is a lot
    // smaller than it used to be, which is what let the board grow) at a
    // typical desktop size; `* 0.9` converts an available height budget into
    // a matching width for this board's fixed 9:10 aspect ratio (height =
    // width * 10/9).
    <div
      className="xiangqi-board-container relative mx-auto"
      style={{ width: 'min(100%, 760px, calc((100vh - 155px) * 0.9))' }}
    >
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
              <Square key={`sq-${col}-${row}`} col={viewCol(col)} row={viewRow(row)} onClick={() => onSquareClick(col, row)} />
            ))}
          </div>

          <div className="move-marker-layer">
            {legalMoves.map((move) => (
              <MoveMarker
                key={`${move.col}-${move.row}`}
                col={viewCol(move.col)}
                row={viewRow(move.row)}
                capture={move.capture}
              />
            ))}
          </div>

          {children}

          <div className="piece-layer">
            {pieces.map((piece) => (
              <Piece
                key={piece.id}
                side={piece.side}
                char={piece.char}
                col={viewCol(piece.col)}
                row={viewRow(piece.row)}
                selected={selectedId === piece.id}
                turnActive={piece.type === 'general' && piece.side === turn}
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
