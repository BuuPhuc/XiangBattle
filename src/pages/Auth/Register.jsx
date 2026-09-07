import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/ui/Icon'
import Button from '../../components/ui/Button'
import useAuth from '../../components/hooks/useAuth'
import authService from '../../services/authService'

// Register → "check your email" → (optional) resend, all on one page: the
// account already exists in Postgres the moment register() succeeds, it's
// only unverified — resend is the recovery path if the first email never
// arrived, not a sign anything failed.
export function Register() {
  const { register } = useAuth()
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)
  const [registered, setRegistered] = useState(null) // { email } | null

  const [resendStatus, setResendStatus] = useState('idle') // 'idle' | 'sending' | 'sent' | 'error'
  const [resendMessage, setResendMessage] = useState(null)

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError(null)
    setSubmitting(true)
    const result = await register(form)
    setSubmitting(false)
    if (!result.success) {
      setFormError(result.message)
      return
    }
    setRegistered({ email: result.email })
  }

  const handleResend = async () => {
    if (!registered) return
    setResendStatus('sending')
    setResendMessage(null)
    try {
      const res = await authService.resendVerification(registered.email)
      setResendStatus('sent')
      setResendMessage(res.message)
    } catch (error) {
      setResendStatus('error')
      setResendMessage(error.response?.data?.message || 'Không thể gửi lại email xác nhận.')
    }
  }

  if (registered) {
    return (
      <div className="max-w-md mx-auto py-24 px-4 text-center space-y-6">
        <Icon name="mark_email_read" className="text-6xl text-primary" />
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Đăng ký thành công!</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Một email xác nhận đã được gửi đến <span className="font-semibold text-on-surface">{registered.email}</span>.
          <br />
          Vui lòng kiểm tra email và xác nhận tài khoản trước khi đăng nhập.
        </p>

        {resendMessage && (
          <div
            className={
              resendStatus === 'error'
                ? 'px-4 py-3 rounded-lg bg-error/10 border border-error/30 text-error font-label-md text-label-md'
                : 'px-4 py-3 rounded-lg bg-secondary/10 border border-secondary/30 text-secondary font-label-md text-label-md'
            }
          >
            {resendMessage}
          </div>
        )}

        <div className="flex flex-col items-center gap-3">
          <Button variant="outline" onClick={handleResend} disabled={resendStatus === 'sending'}>
            {resendStatus === 'sending' ? 'Đang gửi...' : 'Gửi lại email xác nhận'}
          </Button>
          <Link to="/login" className="font-label-md text-label-md text-primary hover:underline">
            Đến trang đăng nhập
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto py-16 px-4">
      <div className="text-center space-y-2 mb-8">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Tạo tài khoản</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">Tham gia XiangBattle để lưu lại thành tích của bạn.</p>
      </div>

      <form onSubmit={handleSubmit} className="glass-panel border border-gold-shimmer/30 p-8 rounded-xl space-y-5">
        {formError && (
          <div className="px-4 py-3 rounded-lg bg-error/10 border border-error/30 text-error font-label-md text-label-md text-center">
            {formError}
          </div>
        )}

        <div className="space-y-1">
          <label className="font-label-sm text-label-sm text-on-surface-variant">Tên người dùng</label>
          <input
            type="text"
            value={form.username}
            onChange={handleChange('username')}
            required
            minLength={3}
            maxLength={20}
            placeholder="player01"
            className="w-full px-4 py-2 rounded-lg border border-outline-variant bg-surface-container focus:outline-none focus:border-primary"
          />
        </div>

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
            minLength={8}
            placeholder="Tối thiểu 8 ký tự"
            className="w-full px-4 py-2 rounded-lg border border-outline-variant bg-surface-container focus:outline-none focus:border-primary"
          />
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Đang đăng ký...' : 'Đăng ký'}
        </Button>

        <p className="text-center font-label-sm text-label-sm text-on-surface-variant">
          Đã có tài khoản?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Đăng nhập
          </Link>
        </p>
      </form>
    </div>
  )
}

export default Register
