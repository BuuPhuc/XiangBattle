// The player's own arrows and circles (right-click drawing — see
// ChessBoard.jsx). Drawn in an SVG laid over .board-inner whose viewBox is
// one unit per 1/100 of a grid step: intersection (col, row) sits at
// (col * 100, row * 100), and .board-inner's own 8:9 shape matches the
// 800 × 900 box, so nothing is stretched. Takes VIEW coordinates (already
// rotated for a flipped board) via `toView`. Purely visual — never catches a
// click (pointer-events: none in index.css).
const ARROW_WIDTH = 14
const HEAD_LENGTH = 38
const HEAD_HALF_WIDTH = 24
// An arrow starts at the edge of the piece it comes from, not its centre.
const START_INSET = 30
const CIRCLE_RADIUS = 46

// `id` is the drawing's key (real board coordinates, see ChessBoard's
// drawingKey) — exposed as data-drawing so tests can tell drawings apart.
function Arrow({ id, from, to }) {
  const x1 = from.col * 100
  const y1 = from.row * 100
  const x2 = to.col * 100
  const y2 = to.row * 100
  const length = Math.hypot(x2 - x1, y2 - y1)
  const ux = (x2 - x1) / length
  const uy = (y2 - y1) / length
  const startX = x1 + ux * START_INSET
  const startY = y1 + uy * START_INSET
  const baseX = x2 - ux * HEAD_LENGTH
  const baseY = y2 - uy * HEAD_LENGTH
  const head = [
    [x2, y2],
    [baseX - uy * HEAD_HALF_WIDTH, baseY + ux * HEAD_HALF_WIDTH],
    [baseX + uy * HEAD_HALF_WIDTH, baseY - ux * HEAD_HALF_WIDTH],
  ]
  return (
    <g className="board-arrow" data-drawing={id}>
      <line x1={startX} y1={startY} x2={baseX} y2={baseY} strokeWidth={ARROW_WIDTH} strokeLinecap="round" />
      <polygon points={head.map((p) => p.join(',')).join(' ')} />
    </g>
  )
}

export function BoardDrawings({ drawings, toView }) {
  if (drawings.length === 0) return null
  return (
    <svg className="board-drawings" viewBox="0 0 800 900" preserveAspectRatio="none" aria-hidden="true">
      {drawings.map((drawing) =>
        drawing.kind === 'arrow' ? (
          <Arrow key={drawing.key} id={drawing.key} from={toView(drawing.from)} to={toView(drawing.to)} />
        ) : (
          <circle
            key={drawing.key}
            data-drawing={drawing.key}
            className="board-circle"
            cx={toView(drawing.at).col * 100}
            cy={toView(drawing.at).row * 100}
            r={CIRCLE_RADIUS}
          />
        )
      )}
    </svg>
  )
}

export default BoardDrawings
