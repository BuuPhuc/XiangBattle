import { cn } from '../utils/cn'

const TONES = {
  error: 'bg-error/10 border-error/30 text-error',
  success: 'bg-secondary/10 border-secondary/30 text-secondary',
}

const SIZES = {
  sm: 'px-4 py-1.5 font-label-sm text-label-sm',
  md: 'px-4 py-3 font-label-md text-label-md',
}

// A tinted message box at the top of a form or page: "Sai mật khẩu",
// "Đã gửi email". Errors are announced right away (role="alert"), success
// notes politely (role="status"); pass `role` to override.
export function Alert({ tone = 'error', size = 'md', className, children, ...props }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('rounded-lg border', TONES[tone], SIZES[size], className)}
      {...props}
    >
      {children}
    </div>
  )
}

export default Alert
