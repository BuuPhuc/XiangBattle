export function CapturedPieces({ moveHistory }) {
  const captured = moveHistory.filter((move) => move.turn === 'black' && move.captured).map((move) => move.captured)

  return (
    <div className="glass-panel border border-gold-shimmer/30 p-4 rounded-xl flex-1 hidden xl:block">
      <h4 className="font-label-sm text-label-sm text-on-surface-variant mb-2 uppercase tracking-wider">
        Quân đã ăn
      </h4>
      {captured.length === 0 ? (
        <p className="font-label-sm text-label-sm text-on-surface-variant/60">Chưa ăn quân nào</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {captured.map((piece, i) => (
            <div
              key={`${piece.id}-${i}`}
              className="w-6 h-6 rounded-full bg-piece-red border-2 border-white flex items-center justify-center text-white text-[10px] font-bold shadow-sm"
            >
              {piece.char}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default CapturedPieces
