import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Alert from '../../components/ui/Alert'
import { Field, Input } from '../../components/ui/Input'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import useAuth from '../../components/hooks/useAuth'
import authService from '../../services/authService'
import { safeReturnPath } from '../../features/auth/returnPath'
import { SESSION_END_MESSAGES } from '../../features/auth/sessionEnd'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  // ?next= — the private page that asked the guest to sign in (see
  // SignInPrompt); they're sent back there afterwards, else to /play.
  const [searchParams] = useSearchParams()
  const returnTo = safeReturnPath(searchParams.get('next'))
  // ?session= — why the previous session ended (expired, revoked, or this
  // device's own "Đăng xuất khỏi tất cả thiết bị"); see sessionEnd.js.
  const sessionReason = searchParams.get('session')
  const sessionNotice = Object.hasOwn(SESSION_END_MESSAGES, sessionReason) ? SESSION_END_MESSAGES[sessionReason] : null
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
    navigate(returnTo)
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

      <Card as="form" padding="lg" onSubmit={handleSubmit} className="space-y-5">
        {sessionNotice && !formError && (
          <Alert tone="success" className="text-center">
            {sessionNotice}
          </Alert>
        )}

        {formError && (
          <Alert className="text-center space-y-2">
            <p>{formError}</p>
            {needsVerification && (
              <Button type="button" variant="outline" size="sm" onClick={handleResend} disabled={resendStatus === 'sending'}>
                {resendStatus === 'sending' ? 'Đang gửi...' : 'Gửi lại email xác nhận'}
              </Button>
            )}
          </Alert>
        )}

        {resendMessage && (
          <Alert tone="success" className="text-center">
            {resendMessage}
          </Alert>
        )}

        <Field label="Email">
          <Input
            type="email"
            value={form.email}
            onChange={handleChange('email')}
            required
            placeholder="player01@gmail.com"
          />
        </Field>

        <Field label="Mật khẩu">
          <Input
            type="password"
            value={form.password}
            onChange={handleChange('password')}
            required
          />
          <div className="text-right">
            <Link to="/forgot-password" className="font-label-sm text-label-sm text-primary hover:underline">
              Quên mật khẩu?
            </Link>
          </div>
        </Field>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </Button>

        <p className="text-center font-label-sm text-label-sm text-on-surface-variant">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="text-primary hover:underline">
            Đăng ký
          </Link>
        </p>
      </Card>
    </div>
  )
}

export default Login
