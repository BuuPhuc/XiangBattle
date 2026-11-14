import Home from '../pages/Home/Home'
import About from '../pages/About/About'
import Login from '../pages/Auth/Login'
import Register from '../pages/Auth/Register'
import VerifyEmail from '../pages/Auth/VerifyEmail'
import ForgotPassword from '../pages/Auth/ForgotPassword'
import ResetPassword from '../pages/Auth/ResetPassword'

export const publicRoutes = [
  { path: '/', element: <Home /> },
  { path: '/about', element: <About /> },
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  { path: '/verify-email', element: <VerifyEmail /> },
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/reset-password', element: <ResetPassword /> },
]

export default publicRoutes
