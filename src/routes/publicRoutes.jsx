import Home from '../pages/Home/Home'
import About from '../pages/About/About'
import Login from '../pages/Auth/Login'
import Register from '../pages/Auth/Register'
import VerifyEmail from '../pages/Auth/VerifyEmail'

export const publicRoutes = [
  { path: '/', element: <Home /> },
  { path: '/about', element: <About /> },
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  { path: '/verify-email', element: <VerifyEmail /> },
]

export default publicRoutes
