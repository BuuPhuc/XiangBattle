import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import MainLayout from '../components/layout/MainLayout'
import AppShellLayout from '../components/layout/AppShellLayout'
import publicRoutes from './publicRoutes'
import appRoutes from './appRoutes'
import privateRoutes from './privateRoutes'

const router = createBrowserRouter([
  {
    element: <MainLayout />,
    children: publicRoutes,
  },
  {
    element: <AppShellLayout />,
    children: [...appRoutes, ...privateRoutes],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}

export default AppRouter
