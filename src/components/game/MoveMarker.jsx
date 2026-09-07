const COL_STEP = 100 / 8
const ROW_STEP = 100 / 9

// Purely visual — clicking still goes through the invisible Square button
// (or the piece itself, for a capture) underneath, so this never needs its
// own click handler. `capture` swaps the small filled dot for a thin ring
// hugging the enemy piece instead, matching the "chấm cho ô trống, vòng nhẹ
// hơn cho ô ăn quân" distinction.
export function MoveMarker({ col, row, capture }) {
  return (
    <div
      className={capture ? 'move-marker move-marker-capture' : 'move-marker move-marker-dot'}
      style={{ left: `${col * COL_STEP}%`, top: `${row * ROW_STEP}%` }}
    />
  )
}

export default MoveMarker
