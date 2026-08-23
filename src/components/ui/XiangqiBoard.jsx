const COLS = 9
const ROWS = 10
const CELL = 36
const MARGIN = 22
const WIDTH = MARGIN * 2 + (COLS - 1) * CELL
const HEIGHT = MARGIN * 2 + (ROWS - 1) * CELL

const x = (col) => MARGIN + col * CELL
const y = (row) => MARGIN + row * CELL

const BLACK_PIECES = [
  ['車', 0, 0], ['馬', 1, 0], ['象', 2, 0], ['士', 3, 0], ['將', 4, 0],
  ['士', 5, 0], ['象', 6, 0], ['馬', 7, 0], ['車', 8, 0],
  ['砲', 1, 2], ['砲', 7, 2],
  ['卒', 0, 3], ['卒', 2, 3], ['卒', 4, 3], ['卒', 6, 3], ['卒', 8, 3],
]

const RED_PIECES = [
  ['兵', 0, 6], ['兵', 2, 6], ['兵', 4, 6], ['兵', 6, 6], ['兵', 8, 6],
  ['炮', 1, 7], ['炮', 7, 7],
  ['車', 0, 9], ['馬', 1, 9], ['相', 2, 9], ['仕', 3, 9], ['帥', 4, 9],
  ['仕', 5, 9], ['相', 6, 9], ['馬', 7, 9], ['車', 8, 9],
]

function Piece({ label, col, row, color, ring }) {
  return (
    <g transform={`translate(${x(col)}, ${y(row)})`}>
      <circle r="14.5" fill="#fbf9f4" stroke={ring} strokeWidth="2" />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="15"
        fontFamily="'Noto Serif', serif"
        fontWeight="700"
        fill={color}
      >
        {label}
      </text>
    </g>
  )
}

export function XiangqiBoard({ className = '' }) {
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={className} role="img" aria-label="Bàn cờ tướng">
      <defs>
        <linearGradient id="wood-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff6e8" />
          <stop offset="100%" stopColor="#f4e3c4" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width={WIDTH} height={HEIGHT} rx="16" fill="url(#wood-bg)" />
      <rect
        x={MARGIN / 2}
        y={MARGIN / 2}
        width={WIDTH - MARGIN}
        height={HEIGHT - MARGIN}
        fill="none"
        stroke="#5D3E28"
        strokeWidth="2"
        rx="4"
      />

      {/* horizontal lines */}
      {Array.from({ length: ROWS }, (_, row) => (
        <line key={`h-${row}`} x1={x(0)} y1={y(row)} x2={x(COLS - 1)} y2={y(row)} stroke="#5D3E28" strokeWidth="1.25" />
      ))}

      {/* vertical lines (outer columns run full height; inner columns break at the river) */}
      {Array.from({ length: COLS }, (_, col) => {
        if (col === 0 || col === COLS - 1) {
          return <line key={`v-${col}`} x1={x(col)} y1={y(0)} x2={x(col)} y2={y(ROWS - 1)} stroke="#5D3E28" strokeWidth="1.25" />
        }
        return (
          <g key={`v-${col}`}>
            <line x1={x(col)} y1={y(0)} x2={x(col)} y2={y(4)} stroke="#5D3E28" strokeWidth="1.25" />
            <line x1={x(col)} y1={y(5)} x2={x(col)} y2={y(9)} stroke="#5D3E28" strokeWidth="1.25" />
          </g>
        )
      })}

      {/* palace diagonals */}
      <line x1={x(3)} y1={y(0)} x2={x(5)} y2={y(2)} stroke="#5D3E28" strokeWidth="1.25" />
      <line x1={x(5)} y1={y(0)} x2={x(3)} y2={y(2)} stroke="#5D3E28" strokeWidth="1.25" />
      <line x1={x(3)} y1={y(7)} x2={x(5)} y2={y(9)} stroke="#5D3E28" strokeWidth="1.25" />
      <line x1={x(5)} y1={y(7)} x2={x(3)} y2={y(9)} stroke="#5D3E28" strokeWidth="1.25" />

      {/* river */}
      <text x={x(2)} y={(y(4) + y(5)) / 2} textAnchor="middle" dominantBaseline="central" fontSize="16" fontFamily="'Noto Serif', serif" fill="#805434" letterSpacing="4">
        楚河
      </text>
      <text x={x(6)} y={(y(4) + y(5)) / 2} textAnchor="middle" dominantBaseline="central" fontSize="16" fontFamily="'Noto Serif', serif" fill="#805434" letterSpacing="4">
        漢界
      </text>

      {BLACK_PIECES.map(([label, col, row]) => (
        <Piece key={`b-${col}-${row}`} label={label} col={col} row={row} color="#1a1a1a" ring="#1a1a1a" />
      ))}
      {RED_PIECES.map(([label, col, row]) => (
        <Piece key={`r-${col}-${row}`} label={label} col={col} row={row} color="#96281B" ring="#96281B" />
      ))}
    </svg>
  )
}

export default XiangqiBoard
