import { Outlet } from 'react-router-dom'
import AppTopBar from './AppTopBar'
import AppSidebar from './AppSidebar'

export function AppShellLayout() {
  return (
    <div className="bg-surface text-on-surface font-body-md antialiased overflow-x-hidden min-h-screen">
      <AppTopBar />
      <div className="flex h-screen pt-[72px] md:pt-0">
        <AppSidebar />
        <main className="flex-1 md:ml-64 p-gutter md:p-margin-desktop overflow-y-auto w-full relative">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AppShellLayout
