import { useCallback, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon'
import Avatar from '../ui/Avatar'
import LogoutConfirmModal from '../ui/LogoutConfirmModal'
import NotificationBell from '../notifications/NotificationBell'
import useAuth from '../hooks/useAuth'

const NAV_ITEMS = [
  // { icon: 'home', label: 'Trang chủ', to: '/play' },
  { icon: 'sports_esports', label: 'Chơi cờ', to: '/play' },
  { icon: 'memory', label: 'Đối đầu AI', to: '/ai' },
  { icon: 'extension', label: 'Cờ thế' },
  { icon: 'school', label: 'Học viện', to: '/academy' },
  // { icon: 'history', label: 'Lịch sử ván đấu' },
  { icon: 'leaderboard', label: 'Bảng xếp hạng', to: '/leaderboard' },
]

const SOCIAL_ITEM = {
  icon: 'groups',
  label: 'Xã hội',
  children: [
    { icon: 'group', label: 'Bạn bè', to: '/friends' },
    { icon: 'emoji_events', label: 'Câu lạc bộ', to: '/clubs' },
  ],
}

const TRAILING_NAV_ITEMS = [{ icon: 'settings', label: 'Cài đặt', to: '/settings' }]

// How long the flyout stays open after the pointer leaves it — long enough
// to cross the small gap between the "Xã hội" row and the panel beside it
// without flickering shut, short enough not to linger once the user has
// clearly moved on.
const FLYOUT_CLOSE_DELAY_MS = 200

const ACTIVE_ITEM_CLASS =
  'flex items-center space-x-3 bg-surface-container-high dark:bg-primary-container text-primary dark:text-on-primary-container rounded-lg px-4 py-3 font-bold font-label-md text-label-md active:scale-98 transition-all duration-200'
const INACTIVE_ITEM_CLASS =
  'flex items-center space-x-3 text-on-surface-variant dark:text-on-surface-variant px-4 py-3 hover:bg-surface-container dark:hover:bg-primary-container/50 hover:translate-x-1 transition-all duration-200 font-label-md text-label-md rounded-lg active:scale-98'
const FLYOUT_ACTIVE_ITEM_CLASS =
  'flex items-center space-x-3 bg-surface-container-high dark:bg-primary-container text-primary dark:text-on-primary-container rounded-lg px-3 py-2.5 font-bold font-label-md text-label-md transition-all duration-200'
const FLYOUT_INACTIVE_ITEM_CLASS =
  'flex items-center space-x-3 text-on-surface-variant dark:text-on-surface-variant px-3 py-2.5 hover:bg-surface-container dark:hover:bg-primary-container/50 transition-all duration-200 font-label-md text-label-md rounded-lg'

function NavLink({ icon, label, to, active }) {
  return (
    <Link to={to ?? '#'} className={active ? ACTIVE_ITEM_CLASS : INACTIVE_ITEM_CLASS}>
      <Icon name={icon} filled={active} />
      <span>{label}</span>
    </Link>
  )
}

export function AppSidebar() {
  const { pathname } = useLocation()
  const { isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()

  const isSocialRoute = SOCIAL_ITEM.children.some((child) => pathname === child.to)
  const [socialOpen, setSocialOpen] = useState(false)
  const closeTimerRef = useRef(null)

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const openSocialFlyout = useCallback(() => {
    clearCloseTimer()
    setSocialOpen(true)
  }, [clearCloseTimer])

  // Delayed close (see FLYOUT_CLOSE_DELAY_MS) — crossing the small gap
  // between the trigger row and the flyout panel beside it briefly passes
  // over the main content area, which would otherwise fire this and shut
  // the panel before the pointer ever reaches it.
  const scheduleCloseSocialFlyout = useCallback(() => {
    clearCloseTimer()
    closeTimerRef.current = setTimeout(() => setSocialOpen(false), FLYOUT_CLOSE_DELAY_MS)
  }, [clearCloseTimer])

  const [confirmingLogout, setConfirmingLogout] = useState(false)
  const cancelLogout = useCallback(() => setConfirmingLogout(false), [])

  const handleConfirmLogout = () => {
    setConfirmingLogout(false)
    logout()
    navigate('/')
  }

  return (
    <aside className="hidden md:flex flex-col h-full pt-10 pb-8 px-4 fixed left-0 top-0 w-64 z-40 bg-surface dark:bg-inverse-surface border-r border-onyx-ink/10 shadow-md">
      <div className="mb-8 px-4">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/" className="font-headline-sm text-headline-sm font-bold text-primary dark:text-primary-fixed-dim tracking-tight">
            XiangBattle
          </Link>
        </div>
        {isAuthenticated ? (
          <div className="flex items-center justify-between gap-2">
            <Link to="/profile" className="flex items-center gap-3 group min-w-0" aria-label="Hồ sơ của bạn">
              <Avatar src={user?.avatarUrl} name={user?.displayName || user?.username} size={40} />
              <div className="min-w-0">
                <p className="font-label-md text-label-md font-semibold text-on-surface group-hover:text-primary transition-colors truncate">
                  {user?.username}
                </p>
                <p className="font-label-sm text-label-sm text-on-surface-variant">Hạng: {user?.rating ?? 1200}</p>
              </div>
            </Link>
            <NotificationBell placement="sidebar" className="flex-shrink-0" />
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
        {/* Also active on a section's sub-pages (/academy/course/...). */}
        {NAV_ITEMS.map(({ icon, label, to }) => (
          <NavLink
            key={label}
            icon={icon}
            label={label}
            to={to}
            active={Boolean(to && (pathname === to || pathname.startsWith(`${to}/`)))}
          />
        ))}

        <div className="relative" onMouseEnter={openSocialFlyout} onMouseLeave={scheduleCloseSocialFlyout}>
          <button
            type="button"
            onClick={() => (socialOpen ? setSocialOpen(false) : openSocialFlyout())}
            aria-expanded={socialOpen}
            aria-haspopup="true"
            className={`w-full ${isSocialRoute ? ACTIVE_ITEM_CLASS : INACTIVE_ITEM_CLASS}`}
          >
            <Icon name={SOCIAL_ITEM.icon} filled={isSocialRoute} />
            <span className="flex-1 text-left">{SOCIAL_ITEM.label}</span>
            <Icon name="chevron_right" className="text-[18px]" />
          </button>

          {socialOpen && (
            <div
              role="menu"
              className="absolute left-full top-0 ml-2 w-56 glass-panel border border-gold-shimmer/30 rounded-xl shadow-lg p-2 space-y-1 z-50"
            >
              {SOCIAL_ITEM.children.map((child) => {
                const active = pathname === child.to
                return (
                  <Link
                    key={child.label}
                    to={child.to}
                    role="menuitem"
                    onClick={() => setSocialOpen(false)}
                    className={active ? FLYOUT_ACTIVE_ITEM_CLASS : FLYOUT_INACTIVE_ITEM_CLASS}
                  >
                    <Icon name={child.icon} filled={active} />
                    <span>{child.label}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {TRAILING_NAV_ITEMS.map(({ icon, label, to }) => (
          <NavLink key={label} icon={icon} label={label} to={to} active={Boolean(to && pathname === to)} />
        ))}
      </nav>

      <div className="mt-auto space-y-2 pt-4 border-t border-onyx-ink/10">
        {isAuthenticated && (
          <button
            type="button"
            onClick={() => setConfirmingLogout(true)}
            className="w-full flex items-center space-x-3 text-on-surface-variant dark:text-on-surface-variant px-4 py-2 hover:bg-surface-container dark:hover:bg-primary-container/50 transition-all duration-200 font-label-md text-label-md rounded-lg"
          >
            <Icon name="logout" />
            <span>Đăng xuất</span>
          </button>
        )}
      </div>

      {confirmingLogout && <LogoutConfirmModal onConfirm={handleConfirmLogout} onCancel={cancelLogout} />}
    </aside>
  )
}

export default AppSidebar
