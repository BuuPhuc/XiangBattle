import { useRef, useState } from 'react'
import Piece from './Piece'
import Square from './Square'
import MoveMarker from './MoveMarker'
import BoardDrawings from './BoardDrawings'

const COL_STEP = 100 / 8
const ROW_STEP = 100 / 9

// Identity of a drawing, in REAL board coordinates — drawing the same thing
// again finds it by this key and removes it.
const drawingKey = (from, to) =>
  to && (to.col !== from.col || to.row !== from.row)
    ? `arrow:${from.col},${from.row}-${to.col},${to.row}`
    : `circle:${from.col},${from.row}`

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
//
// `lastMove` ({ from, to } in real coordinates, or null) tints the two
// squares of the move that led to the position shown — rotated like
// everything else.
//
// `drawingEnabled` (opt-in, off unless a page asks for it — the Academy
// board never does) lets the player annotate the board for themselves:
// right-click-drag from one point to another draws an arrow, a right-click
// on one point circles it, and doing the same again removes it. Drawings
// are stored in real coordinates (so they stay on the right squares when
// the board is flipped), live only in this component — never sent anywhere —
// and are cleared by a left click on the board or when `lastMove` changes
// (a new move, or stepping through history). Only while it's enabled does
// the board swallow the browser's right-click menu. Mouse only: touch
// screens have no right click, so they can't draw yet.
export function ChessBoard({
  pieces,
  selectedId,
  turn,
  legalMoves = [],
  onSquareClick,
  flipped = false,
  lastMove = null,
  drawingEnabled = false,
  children,
}) {
  const viewCol = (col) => (flipped ? 8 - col : col)
  const viewRow = (row) => (flipped ? 9 - row : row)
  const toView = (square) => ({ col: viewCol(square.col), row: viewRow(square.row) })

  const innerRef = useRef(null)
  const dragStart = useRef(null)
  const [drawings, setDrawings] = useState([])
  // Clear drawings whenever the move shown changes — adjusted during render
  // (React's pattern for "reset state when a prop changes"), not in an effect.
  const [drawingsForMove, setDrawingsForMove] = useState(lastMove)
  if (drawingsForMove !== lastMove) {
    setDrawingsForMove(lastMove)
    if (drawings.length > 0) setDrawings([])
  }
  // Switching drawing off drops what was drawn, so it doesn't reappear later.
  if (!drawingEnabled && drawings.length > 0) setDrawings([])

  // The board point under the mouse, in REAL coordinates — null when the
  // pointer is outside the grid (e.g. on the wooden frame).
  const pointFromEvent = (event) => {
    const rect = innerRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return null
    const col = Math.round(((event.clientX - rect.left) / rect.width) * 8)
    const row = Math.round(((event.clientY - rect.top) / rect.height) * 9)
    if (col < 0 || col > 8 || row < 0 || row > 9) return null
    return { col: viewCol(col), row: viewRow(row) }
  }

  const drawingHandlers = drawingEnabled
    ? {
        onContextMenu: (event) => event.preventDefault(),
        onMouseDown: (event) => {
          if (event.button === 2) {
            dragStart.current = pointFromEvent(event)
          } else if (event.button === 0 && drawings.length > 0) {
            setDrawings([])
          }
        },
        onMouseUp: (event) => {
          if (event.button !== 2) return
          const from = dragStart.current
          dragStart.current = null
          const to = pointFromEvent(event)
          if (!from || !to) return
          const key = drawingKey(from, to)
          const isArrow = key.startsWith('arrow:')
          setDrawings((current) =>
            current.some((drawing) => drawing.key === key)
              ? current.filter((drawing) => drawing.key !== key)
              : [...current, isArrow ? { key, kind: 'arrow', from, to } : { key, kind: 'circle', at: from }]
          )
        },
      }
    : {}

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
        <div className="board-inner" ref={innerRef} {...drawingHandlers}>
          <div className="grid-lines">
            <div className="grid-half">
              {Array.from({ length: 32 }, (_, i) => (
                <div key={`upper-${i}`} className="grid-cell" />
              ))}
            </div>
            <div className="river-area">
              <span className="river-text">楚 河</span>
              <span className="river-domain">XiangBattle</span>
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

          {lastMove && (
            <div className="last-move-layer">
              {[
                ['from', lastMove.from],
                ['to', lastMove.to],
              ].map(([kind, square]) => (
                <div
                  key={kind}
                  className={`last-move-square last-move-${kind}`}
                  data-square={`${square.col},${square.row}`}
                  style={{ left: `${viewCol(square.col) * COL_STEP}%`, top: `${viewRow(square.row) * ROW_STEP}%` }}
                />
              ))}
            </div>
          )}

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

          {drawingEnabled && <BoardDrawings drawings={drawings} toView={toView} />}
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
