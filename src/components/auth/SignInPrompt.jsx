import { Link, useLocation } from 'react-router-dom'
import Icon from '../ui/Icon'
import Button from '../ui/Button'
import { loginPathFor } from '../../features/auth/returnPath'

// Shown in place of a private page to someone who isn't signed in (see
// privateRoutes.jsx's RequireAuth) — instead of bouncing them to the home
// page with no explanation. The app shell (sidebar) stays; "Đăng nhập"
// brings them back to this exact page afterwards.
export function SignInPrompt() {
  const { pathname, search } = useLocation()

  return (
    <div className="max-w-md mx-auto py-24 px-4 text-center space-y-5" data-testid="sign-in-prompt">
      <Icon name="lock" className="text-5xl text-on-surface-variant/50 block" />
      <h1 className="font-headline-sm text-headline-sm text-on-surface">Bạn cần đăng nhập</h1>
      <p className="font-body-md text-body-md text-on-surface-variant">
        Đăng nhập để dùng tính năng này. Chưa có tài khoản? Đăng ký miễn phí chỉ trong một phút.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Button as={Link} to={loginPathFor(pathname + search)}>
          Đăng nhập
        </Button>
        <Button as={Link} to="/register" variant="outline">
          Đăng ký
        </Button>
      </div>
    </div>
  )
}

export default SignInPrompt
