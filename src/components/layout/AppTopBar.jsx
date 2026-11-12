import { Link } from 'react-router-dom'
import Icon from '../ui/Icon'
import Avatar from '../ui/Avatar'
import NotificationBell from '../notifications/NotificationBell'
import useAuth from '../hooks/useAuth'

export function AppTopBar() {
  const { isAuthenticated, user } = useAuth()

  return (
    <nav
      aria-label="Top Navigation"
      className="fixed top-0 w-full z-50 bg-surface/80 dark:bg-inverse-surface/80 backdrop-blur-xl md:hidden flex justify-between items-center px-gutter py-4 shadow-sm"
    >
      <span className="font-headline-md text-headline-md font-bold text-primary dark:text-primary-fixed-dim tracking-tight">
        XiangBattle
      </span>
      <div className="flex items-center gap-4">
        <NotificationBell placement="topbar" />
        {isAuthenticated ? (
          <Link
            to="/profile"
            className="text-on-surface-variant/70 hover:text-primary transition-colors duration-300 flex items-center gap-2"
            aria-label="Hồ sơ của bạn"
          >
            <Avatar src={user?.avatarUrl} name={user?.displayName || user?.username} size={28} />
            <span className="font-label-md text-label-md hidden sm:inline">{user?.username}</span>
          </Link>
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
