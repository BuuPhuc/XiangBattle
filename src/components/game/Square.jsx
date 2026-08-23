const COL_STEP = 100 / 8
const ROW_STEP = 100 / 9

// Invisible click target for every board intersection, so empty squares are
// clickable too (pieces sit above these and capture the click themselves).
export function Square({ col, row, onClick }) {
  return (
    <button
      type="button"
      className="absolute w-[10%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-auto cursor-pointer"
      style={{ left: `${col * COL_STEP}%`, top: `${row * ROW_STEP}%`, zIndex: 5 }}
      onClick={onClick}
      aria-label={`Ô cột ${col + 1} hàng ${row + 1}`}
    />
  )
}

export default Square
