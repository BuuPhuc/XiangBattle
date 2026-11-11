// Difficulty levels. Depth is in plies (half-moves); the search stops at
// whichever comes first, maxDepth or timeMs. `noise` (≈ centipawns) makes
// the weaker levels sometimes choose a worse move, the way a human would.
export const AI_LEVELS = {
  easy: { id: 'easy', label: 'Dễ', description: 'Mới làm quen, hay đi sai', maxDepth: 2, timeMs: 800, noise: 150 },
  medium: { id: 'medium', label: 'Trung bình', description: 'Biết ăn quân, tránh bẫy đơn giản', maxDepth: 3, timeMs: 2500, noise: 15 },
  hard: { id: 'hard', label: 'Khó', description: 'Tính toán sâu, ít sai sót', maxDepth: 6, timeMs: 3000, noise: 0 },
}

export const AI_LEVEL_ORDER = ['easy', 'medium', 'hard']
