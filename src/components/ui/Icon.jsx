import { cn } from '../utils/cn'

// The icon scale. Leave `size` out for the default 24px (set on
// .material-symbols-outlined in index.css).
//   xs  14px — inside a badge
//   sm  16px — inside a small button (Button size="sm")
//   md  18px — inside a normal button, next to body text or a list heading
//   lg  30px — feature / section illustration
//   xl  36px — the icon square at the top of a dialog
//   2xl 48px — empty states and error pages
// Only the font size is set, so the icon box stays exactly as tall as the
// glyph (line-height 1) and never pushes the text next to it down.
const SIZES = {
  xs: 'text-[14px]',
  sm: 'text-[16px]',
  md: 'text-[18px]',
  lg: 'text-[30px]',
  xl: 'text-[36px]',
  '2xl': 'text-[48px]',
}

export function Icon({ name, size, filled = false, className = '', ...props }) {
  return (
    <span
      className={cn('material-symbols-outlined', SIZES[size], className)}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
      {...props}
    >
      {name}
    </span>
  )
}

export default Icon
