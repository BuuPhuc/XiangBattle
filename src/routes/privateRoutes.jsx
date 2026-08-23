import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../components/hooks/useAuth'
import Dashboard from '../pages/Dashboard/Dashboard'

function RequireAuth() {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <Outlet /> : <Navigate to="/" replace />
}

export const privateRoutes = [
  {
    element: <RequireAuth />,
    children: [{ path: '/dashboard', element: <Dashboard /> }],
  },
]

export default privateRoutes
