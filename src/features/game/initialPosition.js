// Standard Xiangqi starting position. Columns 0-8 (left to right), rows 0-9 (black's back
// rank at row 0, red's back rank at row 9). Red and black traditionally use different
// characters for the same piece type (e.g. 車 for black chariot, 俥 for red chariot).
// `type` drives movement rules (see rules/); `char` is purely for display.
export const INITIAL_PIECES = [
  // Black (top)
  { id: 'b-r1', side: 'black', type: 'rook', char: '車', col: 0, row: 0 },
  { id: 'b-h1', side: 'black', type: 'horse', char: '馬', col: 1, row: 0 },
  { id: 'b-e1', side: 'black', type: 'elephant', char: '象', col: 2, row: 0 },
  { id: 'b-a1', side: 'black', type: 'advisor', char: '士', col: 3, row: 0 },
  { id: 'b-g', side: 'black', type: 'general', char: '將', col: 4, row: 0 },
  { id: 'b-a2', side: 'black', type: 'advisor', char: '士', col: 5, row: 0 },
  { id: 'b-e2', side: 'black', type: 'elephant', char: '象', col: 6, row: 0 },
  { id: 'b-h2', side: 'black', type: 'horse', char: '馬', col: 7, row: 0 },
  { id: 'b-r2', side: 'black', type: 'rook', char: '車', col: 8, row: 0 },
  { id: 'b-c1', side: 'black', type: 'cannon', char: '炮', col: 1, row: 2 },
  { id: 'b-c2', side: 'black', type: 'cannon', char: '炮', col: 7, row: 2 },
  { id: 'b-s1', side: 'black', type: 'pawn', char: '卒', col: 0, row: 3 },
  { id: 'b-s2', side: 'black', type: 'pawn', char: '卒', col: 2, row: 3 },
  { id: 'b-s3', side: 'black', type: 'pawn', char: '卒', col: 4, row: 3 },
  { id: 'b-s4', side: 'black', type: 'pawn', char: '卒', col: 6, row: 3 },
  { id: 'b-s5', side: 'black', type: 'pawn', char: '卒', col: 8, row: 3 },

  // Red (bottom)
  { id: 'r-s1', side: 'red', type: 'pawn', char: '兵', col: 0, row: 6 },
  { id: 'r-s2', side: 'red', type: 'pawn', char: '兵', col: 2, row: 6 },
  { id: 'r-s3', side: 'red', type: 'pawn', char: '兵', col: 4, row: 6 },
  { id: 'r-s4', side: 'red', type: 'pawn', char: '兵', col: 6, row: 6 },
  { id: 'r-s5', side: 'red', type: 'pawn', char: '兵', col: 8, row: 6 },
  { id: 'r-c1', side: 'red', type: 'cannon', char: '炮', col: 1, row: 7 },
  { id: 'r-c2', side: 'red', type: 'cannon', char: '炮', col: 7, row: 7 },
  { id: 'r-r1', side: 'red', type: 'rook', char: '俥', col: 0, row: 9 },
  { id: 'r-h1', side: 'red', type: 'horse', char: '傌', col: 1, row: 9 },
  { id: 'r-e1', side: 'red', type: 'elephant', char: '相', col: 2, row: 9 },
  { id: 'r-a1', side: 'red', type: 'advisor', char: '仕', col: 3, row: 9 },
  { id: 'r-g', side: 'red', type: 'general', char: '帥', col: 4, row: 9 },
  { id: 'r-a2', side: 'red', type: 'advisor', char: '仕', col: 5, row: 9 },
  { id: 'r-e2', side: 'red', type: 'elephant', char: '相', col: 6, row: 9 },
  { id: 'r-h2', side: 'red', type: 'horse', char: '傌', col: 7, row: 9 },
  { id: 'r-r2', side: 'red', type: 'rook', char: '俥', col: 8, row: 9 },
]

export default INITIAL_PIECES
