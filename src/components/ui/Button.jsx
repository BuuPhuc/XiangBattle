import { cn } from '../utils/cn'

// The press animation the original variants have always had. The disabled
// overrides only stop a disabled button from "bouncing" on hover/click; how
// faded a disabled primary/outline button looks is still up to the caller
// (most pass `disabled:opacity-50`, the "Đã gửi"-style status buttons pass
// `opacity-80 cursor-default`) so those keep looking exactly as before.
const PRESS = 'hover:scale-[1.02] active:scale-90 disabled:hover:scale-100 disabled:active:scale-100'

const VARIANTS = {
  // Main action of a screen or dialog.
  primary: `${PRESS} bg-primary text-on-primary hover:bg-on-primary-fixed-variant wood-shadow`,
  container: `${PRESS} bg-primary-container text-on-primary-container shadow-md`,
  // Second action next to a primary one ("Xem lại ván đấu", "Đầu hàng").
  outline: `${PRESS} bg-transparent text-primary border-2 border-primary hover:bg-primary/5`,
  'outline-sm': `${PRESS} bg-transparent text-primary border border-primary hover:bg-jade-light/50`,
  gold: `${PRESS} bg-gold-shimmer text-wood-dark shadow-xl shadow-black/20 font-bold tracking-wide`,
  // Cancel / decline / low-key tool buttons ("Hủy", "Từ chối", "Hoàn tác", "Làm mới").
  ghost:
    'bg-transparent text-on-surface-variant border border-outline-variant hover:bg-surface-container disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed',
  // Destructive confirm ("Đăng xuất", "Đầu hàng" inside the confirm dialog).
  danger: `${PRESS} bg-error text-on-error hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed`,
  // Text-only action inside a sentence or a panel header ("Thử lại", "Đánh dấu tất cả đã đọc").
  link: 'text-primary font-semibold hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-default',
  // Text-only action that should not compete with the buttons above it ("Làm lại", "Chơi lại" under a lesson).
  quiet: 'text-on-surface-variant hover:text-primary disabled:opacity-40 disabled:cursor-default',
  // Square icon-only button (board navigation, page arrows). Always give it an aria-label.
  icon: 'text-on-surface-variant hover:bg-surface-container disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed',
}

const SIZES = {
  sm: 'px-4 py-2 text-label-sm font-label-sm rounded-md',
  md: 'px-6 py-2 text-label-md font-label-md rounded-md',
  lg: 'px-8 py-4 text-label-md font-label-md rounded-lg',
  xl: 'px-10 py-5 text-lg font-label-md rounded-lg',
}

// Variants with no box of their own size by text or by icon instead.
const TEXT_SIZES = {
  sm: 'gap-1 text-label-sm font-label-sm',
  md: 'gap-1.5 text-label-md font-label-md',
}

const ICON_SIZES = {
  sm: 'p-1.5 rounded',
  md: 'p-2 rounded',
}

function sizeClass(variant, size) {
  if (variant === 'link' || variant === 'quiet') return TEXT_SIZES[size] ?? TEXT_SIZES.md
  if (variant === 'icon') return ICON_SIZES[size] ?? ICON_SIZES.md
  return SIZES[size]
}

export function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) {
  // A plain <button> defaults to type="submit"; only keep that inside forms
  // when the caller asks for it.
  const typeProps = Component === 'button' && props.type === undefined ? { type: 'button' } : null
  return (
    <Component
      className={cn(
        'inline-flex items-center justify-center gap-2 transition duration-200',
        VARIANTS[variant],
        sizeClass(variant, size),
        className
      )}
      {...typeProps}
      {...props}
    >
      {children}
    </Component>
  )
}

export default Button
