import { Link } from 'react-router-dom'
import Icon from '../ui/Icon'
import useAuth from '../hooks/useAuth'

export function AppTopBar() {
  const { isAuthenticated, user } = useAuth()

  return (
    <nav
      aria-label="Top Navigation"
      className="fixed top-0 w-full z-50 bg-surface/80 dark:bg-inverse-surface/80 backdrop-blur-xl md:hidden flex justify-between items-center px-gutter py-4 shadow-sm"
    >
      <span className="font-headline-md text-headline-md font-bold text-primary dark:text-primary-fixed-dim tracking-tight">
        Xiangqi Master
      </span>
      <div className="flex items-center gap-4">
        <button aria-label="Thông báo" className="text-on-surface-variant/70 hover:text-primary transition-colors duration-300 active:scale-95">
          <Icon name="notifications" />
        </button>
        {isAuthenticated ? (
          <span className="text-on-surface-variant/70 flex items-center" aria-label="Tài khoản">
            <Icon name="person" className="mr-2" />
            <span className="font-label-md text-label-md hidden sm:inline">{user?.username}</span>
          </span>
        ) : (
          <Link
            to="/login"
            aria-label="Đăng nhập"
            className="text-on-surface-variant/70 hover:text-primary transition-colors duration-300 active:scale-95 flex items-center"
          >
            <Icon name="person" className="mr-2" />
            <span className="font-label-md text-label-md hidden sm:inline">Đăng nhập</span>
          </Link>
        )}
      </div>
    </nav>
  )
}

export default AppTopBar
