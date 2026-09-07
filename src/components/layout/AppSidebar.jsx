import { Link, useLocation, useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon'
import useAuth from '../hooks/useAuth'

const NAV_ITEMS = [
  // { icon: 'home', label: 'Trang chủ', to: '/play' },
  { icon: 'sports_esports', label: 'Chơi cờ', to: '/play' },
  { icon: 'memory', label: 'Đối đầu AI' },
  { icon: 'extension', label: 'Cờ thế' },
  { icon: 'school', label: 'Học viện' },
  { icon: 'history', label: 'Lịch sử ván đấu' },
  { icon: 'settings', label: 'Cài đặt' },
]

export function AppSidebar() {
  const { pathname } = useLocation()
  const { isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <aside className="hidden md:flex flex-col h-full pt-10 pb-8 px-4 fixed left-0 top-0 w-64 z-40 bg-surface dark:bg-inverse-surface border-r border-onyx-ink/10 shadow-md">
      <div className="mb-8 px-4">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/" className="font-headline-sm text-headline-sm font-bold text-primary dark:text-primary-fixed-dim tracking-tight">
            Xiangqi Master
          </Link>
        </div>
        {isAuthenticated ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold">
              <Icon name="person" />
            </div>
            <div>
              <p className="font-label-md text-label-md font-semibold text-on-surface">{user?.username}</p>
              <p className="font-label-sm text-label-sm text-on-surface-variant">Hạng: {user?.rating ?? 1200}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center font-bold">
              <Icon name="person" />
            </div>
            <div>
              <Link to="/login" className="font-label-md text-label-md font-semibold text-primary hover:underline">
                Đăng nhập
              </Link>
              <p className="font-label-sm text-label-sm text-on-surface-variant">Khách</p>
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-2">
        {NAV_ITEMS.map(({ icon, label, to }) => {
          const active = to && pathname === to
          return (
            <Link
              key={label}
              to={to ?? '#'}
              className={
                active
                  ? 'flex items-center space-x-3 bg-surface-container-high dark:bg-primary-container text-primary dark:text-on-primary-container rounded-lg px-4 py-3 font-bold font-label-md text-label-md active:scale-98 transition-all duration-200'
                  : 'flex items-center space-x-3 text-on-surface-variant dark:text-on-surface-variant px-4 py-3 hover:bg-surface-container dark:hover:bg-primary-container/50 hover:translate-x-1 transition-all duration-200 font-label-md text-label-md rounded-lg active:scale-98'
              }
            >
              <Icon name={icon} filled={active} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto space-y-2 pt-4 border-t border-onyx-ink/10">
        <Link
          to="/game"
          className="w-full bg-primary text-on-primary py-3 rounded-lg font-label-md text-label-md flex items-center justify-center gap-2 transition-transform duration-200 hover:scale-[1.02] hover:shadow-[0_4px_12px_rgba(139,94,60,0.15)]"
        >
          <Icon name="play_arrow" />
          Bắt đầu ván mới
        </Link>
        <a className="flex items-center space-x-3 text-on-surface-variant dark:text-on-surface-variant px-4 py-2 hover:bg-surface-container dark:hover:bg-primary-container/50 transition-all duration-200 font-label-md text-label-md rounded-lg" href="#">
          <Icon name="help" />
          <span>Hỗ trợ</span>
        </a>
        <a className="flex items-center space-x-3 text-on-surface-variant dark:text-on-surface-variant px-4 py-2 hover:bg-surface-container dark:hover:bg-primary-container/50 transition-all duration-200 font-label-md text-label-md rounded-lg" href="#">
          <Icon name="info" />
          <span>Giới thiệu</span>
        </a>
        {isAuthenticated && (
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 text-on-surface-variant dark:text-on-surface-variant px-4 py-2 hover:bg-surface-container dark:hover:bg-primary-container/50 transition-all duration-200 font-label-md text-label-md rounded-lg"
          >
            <Icon name="logout" />
            <span>Đăng xuất</span>
          </button>
        )}
      </div>
    </aside>
  )
}

export default AppSidebar
