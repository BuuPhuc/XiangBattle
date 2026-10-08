import { Outlet } from 'react-router-dom'
import AppTopBar from './AppTopBar'
import AppSidebar from './AppSidebar'
import useAuth from '../hooks/useAuth'
import NotificationProvider from '../../features/notifications/NotificationProvider'
import useChallengeAcceptedRedirect from '../../features/challenge/useChallengeAcceptedRedirect'

export function AppShellLayout() {
  const { isAuthenticated, user } = useAuth()
  // Takes a challenger into the match the moment their challenge is
  // accepted, whatever page of the shell they are on.
  useChallengeAcceptedRedirect(isAuthenticated)

  return (
    // Keyed by account so logging out / switching user remounts it with
    // empty state instead of carrying the previous user's notifications.
    <NotificationProvider key={user?.id ?? 'guest'} enabled={isAuthenticated}>
      <div className="bg-surface text-on-surface font-body-md antialiased overflow-x-hidden min-h-screen">
        <AppTopBar />
        <div className="flex h-screen pt-[72px] md:pt-0">
          <AppSidebar />
          <main className="flex-1 md:ml-64 p-gutter md:p-margin-desktop overflow-y-auto overflow-x-hidden w-full relative">
            <Outlet />
          </main>
        </div>
      </div>
    </NotificationProvider>
  )
}

export default AppShellLayout
