// How each Phân tích ván grade looks (move list, analysis panel): its symbol
// and label come from analysis.js's GRADES, the colour from here.
import { GRADES } from './analysis.js'

const COLOR = {
  inaccuracy: 'text-[#a16207]', // amber
  mistake: 'text-[#c2410c]', // orange
  blunder: 'text-error',
}

// { symbol, label, className } for a grade id, or null for none.
export function gradeStyle(grade) {
  if (!grade || !GRADES[grade]) return null
  return { ...GRADES[grade], className: COLOR[grade] }
}
