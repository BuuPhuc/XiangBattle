import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import useAuth from '../../components/hooks/useAuth'
import authService from '../../services/authService'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)
  const [needsVerification, setNeedsVerification] = useState(false)

  const [resendStatus, setResendStatus] = useState('idle')
  const [resendMessage, setResendMessage] = useState(null)

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError(null)
    setNeedsVerification(false)
    setSubmitting(true)
    const result = await login(form)
    setSubmitting(false)
    if (!result.success) {
      setFormError(result.message)
      setNeedsVerification(result.code === 'EMAIL_NOT_VERIFIED')
      return
    }
    navigate('/play')
  }

  const handleResend = async () => {
    setResendStatus('sending')
    setResendMessage(null)
    try {
      const res = await authService.resendVerification(form.email)
      setResendStatus('sent')
      setResendMessage(res.message)
    } catch (error) {
      setResendStatus('error')
      setResendMessage(error.response?.data?.message || 'Không thể gửi lại email xác nhận.')
    }
  }

  return (
    <div className="max-w-md mx-auto py-16 px-4">
      <div className="text-center space-y-2 mb-8">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Đăng nhập</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">Chào mừng trở lại XiangBattle.</p>
      </div>

      <form onSubmit={handleSubmit} className="glass-panel border border-gold-shimmer/30 p-8 rounded-xl space-y-5">
        {formError && (
          <div className="px-4 py-3 rounded-lg bg-error/10 border border-error/30 text-error font-label-md text-label-md text-center space-y-2">
            <p>{formError}</p>
            {needsVerification && (
              <Button type="button" variant="outline" size="sm" onClick={handleResend} disabled={resendStatus === 'sending'}>
                {resendStatus === 'sending' ? 'Đang gửi...' : 'Gửi lại email xác nhận'}
              </Button>
            )}
          </div>
        )}

        {resendMessage && (
          <div className="px-4 py-3 rounded-lg bg-secondary/10 border border-secondary/30 text-secondary font-label-md text-label-md text-center">
            {resendMessage}
          </div>
        )}

        <div className="space-y-1">
          <label className="font-label-sm text-label-sm text-on-surface-variant">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={handleChange('email')}
            required
            placeholder="player01@gmail.com"
            className="w-full px-4 py-2 rounded-lg border border-outline-variant bg-surface-container focus:outline-none focus:border-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="font-label-sm text-label-sm text-on-surface-variant">Mật khẩu</label>
          <input
            type="password"
            value={form.password}
            onChange={handleChange('password')}
            required
            className="w-full px-4 py-2 rounded-lg border border-outline-variant bg-surface-container focus:outline-none focus:border-primary"
          />
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </Button>

        <p className="text-center font-label-sm text-label-sm text-on-surface-variant">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="text-primary hover:underline">
            Đăng ký
          </Link>
        </p>
      </form>
    </div>
  )
}

export default Login
