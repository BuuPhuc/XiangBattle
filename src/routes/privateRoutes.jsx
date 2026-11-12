import { Outlet } from 'react-router-dom'
import { useAuth } from '../components/hooks/useAuth'
import SignInPrompt from '../components/auth/SignInPrompt'
import Replay from '../pages/Replay/Replay'
import Profile from '../pages/Profile/Profile'
import EditProfile from '../pages/Profile/EditProfile'
import PublicProfile from '../pages/Profile/PublicProfile'
import Friends from '../pages/Friends/Friends'

// Pages that need an account. Waits for a saved session to be confirmed
// before deciding (reloading a private page while signed in used to bounce
// because the session hadn't been restored yet on the first render). A
// guest — or a saved session that turned out expired — gets a sign-in
// prompt right there, inside the app shell, instead of being sent to the
// home page with no explanation; signing in returns them to this page.
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
  return <SignInPrompt />
}

export const privateRoutes = [
  {
    element: <RequireAuth />,
    children: [
      { path: '/replay/:gameId', element: <Replay /> },
      { path: '/profile', element: <Profile /> },
      { path: '/profile/edit', element: <EditProfile /> },
      { path: '/profile/:userId', element: <PublicProfile /> },
      { path: '/friends', element: <Friends /> },
    ],
  },
]

export default privateRoutes
