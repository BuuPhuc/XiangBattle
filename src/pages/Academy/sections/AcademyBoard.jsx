import ChessBoard from '../../../components/game/ChessBoard'

const COL_STEP = 100 / 8
const ROW_STEP = 100 / 9

// The hint arrow runs between the two squares' edges rather than their
// centres (gaps in board cells; a piece is 0.8 of a cell wide), so it never
// covers the moving piece's character and its head stops at the destination.
const ARROW_START_GAP = 0.46
const ARROW_END_GAP = 0.3

function Marker({ square, variant }) {
  return (
    <div
      className={`academy-marker academy-marker-${variant}`}
      style={{ left: `${square.col * COL_STEP}%`, top: `${square.row * ROW_STEP}%` }}
    />
  )
}

// Drawn in board cells (viewBox 8 x 9 — the grid is 8 cells wide and 9
// tall, and the cells are square), so the coordinates are the squares' own.
function HintArrow({ from, to }) {
  const dCol = to.col - from.col
  const dRow = to.row - from.row
  const length = Math.hypot(dCol, dRow)
  if (length === 0) return null

  const startCol = from.col + (dCol / length) * ARROW_START_GAP
  const startRow = from.row + (dRow / length) * ARROW_START_GAP
  const endCol = to.col - (dCol / length) * ARROW_END_GAP
  const endRow = to.row - (dRow / length) * ARROW_END_GAP

  return (
    <svg className="academy-arrow" viewBox="0 0 8 9" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <marker id="academy-arrow-head" markerWidth="4" markerHeight="4" refX="2.6" refY="2" orient="auto">
          <path d="M0,0 L4,2 L0,4 Z" fill="currentColor" />
        </marker>
      </defs>
      <line
        x1={startCol}
        y1={startRow}
        x2={endCol}
        y2={endRow}
        stroke="currentColor"
        strokeWidth="0.14"
        strokeLinecap="round"
        markerEnd="url(#academy-arrow-head)"
      />
    </svg>
  )
}

// The Academy's board: the game's own ChessBoard (same pieces, same grid,
// same click handling, same legal-move dots), plus an overlay for what only
// a lesson needs — the target square, hint rings/arrow and the wrong-move
// flash. `turn` is left out on purpose: there are no turns here, so no
// general gets the "to move" ring.
export function AcademyBoard({ pieces, selectedId, moveMarkers, targetSquare, hint, wrongSquare, onSquareClick }) {
  return (
    <ChessBoard pieces={pieces} selectedId={selectedId} legalMoves={moveMarkers} onSquareClick={onSquareClick}>
      <div className="academy-overlay">
        {targetSquare && <Marker square={targetSquare} variant="target" />}
        {hint && <Marker square={hint.from} variant="hint" />}
        {hint && hint.to && <Marker square={hint.to} variant="hint" />}
        {wrongSquare && <Marker key={wrongSquare.attempt} square={wrongSquare} variant="wrong" />}
      </div>
      {hint && hint.showArrow && <HintArrow from={hint.from} to={hint.to} />}
    </ChessBoard>
  )
}

export default AcademyBoard
