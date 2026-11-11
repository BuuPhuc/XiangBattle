import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../components/hooks/useAuth'
import Dashboard from '../pages/Dashboard/Dashboard'
import Replay from '../pages/Replay/Replay'
import Profile from '../pages/Profile/Profile'
import EditProfile from '../pages/Profile/EditProfile'
import PublicProfile from '../pages/Profile/PublicProfile'
import Leaderboard from '../pages/Leaderboard/Leaderboard'
import Friends from '../pages/Friends/Friends'
import ClubComingSoon from '../pages/Social/ClubComingSoon'
import Settings from '../pages/Settings/Settings'

// Waits for a saved session to be confirmed before deciding: reloading a
// private page while signed in used to redirect to "/" because the session
// hadn't been restored yet on the first render.
function RequireAuth() {
  const { isAuthenticated, isRestoring } = useAuth()
  if (isAuthenticated) return <Outlet />
  if (isRestoring) {
    return (
      <div className="py-24 text-center" aria-label="Đang tải">
        <span className="w-3 h-3 rounded-full bg-secondary animate-pulse inline-block" />
      </div>
    )
  }
  return <Navigate to="/" replace />
}

export const privateRoutes = [
  {
    element: <RequireAuth />,
    children: [
      { path: '/dashboard', element: <Dashboard /> },
      { path: '/replay/:gameId', element: <Replay /> },
      { path: '/profile', element: <Profile /> },
      { path: '/profile/edit', element: <EditProfile /> },
      { path: '/profile/:userId', element: <PublicProfile /> },
      { path: '/leaderboard', element: <Leaderboard /> },
      { path: '/friends', element: <Friends /> },
      { path: '/clubs', element: <ClubComingSoon /> },
      { path: '/settings', element: <Settings /> },
    ],
  },
]

export default privateRoutes
