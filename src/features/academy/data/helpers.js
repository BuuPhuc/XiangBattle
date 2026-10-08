// Tiny shorthands so a challenge position reads at a glance. They only build
// plain objects — the challenge data stays plain, serializable data.
// Coordinates are the board's own: col 0-8 left to right, row 0-9 top
// (black's back rank) to bottom (red's back rank).

export const red = (type, col, row) => ({ side: 'red', type, col, row })
export const black = (type, col, row) => ({ side: 'black', type, col, row })

export const move = (fromCol, fromRow, toCol, toRow) => ({ from: [fromCol, fromRow], to: [toCol, toRow] })
