import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../components/hooks/useAuth'
import Dashboard from '../pages/Dashboard/Dashboard'
import Replay from '../pages/Replay/Replay'
import Profile from '../pages/Profile/Profile'
import EditProfile from '../pages/Profile/EditProfile'

function RequireAuth() {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <Outlet /> : <Navigate to="/" replace />
}

export const privateRoutes = [
  {
    element: <RequireAuth />,
    children: [
      { path: '/dashboard', element: <Dashboard /> },
      { path: '/replay/:gameId', element: <Replay /> },
      { path: '/profile', element: <Profile /> },
      { path: '/profile/edit', element: <EditProfile /> },
    ],
  },
]

export default privateRoutes
