import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'

export function MainLayout() {
  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col selection:bg-gold-shimmer/30 selection:text-primary">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

export default MainLayout
