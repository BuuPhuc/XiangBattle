import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../ui/Button'
import LogoutConfirmModal from '../ui/LogoutConfirmModal'
import useAuth from '../hooks/useAuth'

const NAV_LINKS = [
  // { label: 'Play', href: '#', active: true },
  // { label: 'Rules', href: '#' },
  // { label: 'Leaderboard', href: '#' },
  // { label: 'Academy', href: '#' },
]

export function Navbar() {
  const { isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()

  const [confirmingLogout, setConfirmingLogout] = useState(false)
  const cancelLogout = useCallback(() => setConfirmingLogout(false), [])

  const handleConfirmLogout = () => {
    setConfirmingLogout(false)
    logout()
    navigate('/')
  }

  return (
    <nav className="w-full bg-surface/90 dark:bg-surface-dim/90 backdrop-blur-md border-b border-outline-variant/30 shadow-sm sticky top-0 z-50">
      <div className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto h-20">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-headline-md font-headline-md font-bold text-secondary dark:text-secondary-fixed">
            XiangBattle
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={
                link.active
                  ? 'text-secondary dark:text-secondary-fixed font-bold border-b-2 border-secondary font-label-md text-label-md pb-1'
                  : 'text-on-surface-variant dark:text-surface-variant hover:text-primary transition-colors font-label-md text-label-md'
              }
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              <span className="hidden md:inline font-label-md text-label-md text-on-surface-variant">
                {user?.username}
              </span>
              <Button variant="outline-sm" size="sm" className="hidden md:inline-flex" onClick={() => setConfirmingLogout(true)}>
                Đăng xuất
              </Button>
            </>
          ) : (
            <Button as={Link} to="/login" variant="outline-sm" size="sm" className="hidden md:inline-flex">
              Đăng nhập
            </Button>
          )}
          <Button as={Link} to="/play" variant="container" size="md">
            Chơi ngay
          </Button>
        </div>
      </div>

      {confirmingLogout && <LogoutConfirmModal onConfirm={handleConfirmLogout} onCancel={cancelLogout} />}
    </nav>
  )
}

export default Navbar
