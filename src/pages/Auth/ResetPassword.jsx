import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Alert from '../../components/ui/Alert'
import { Field, Input } from '../../components/ui/Input'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import authService from '../../services/authService'
import { endSessionAndLeave, setOwnSessionEndInFlight } from '../../features/auth/sessionEnd'

const PASSWORD_MIN_LENGTH = 8 // same rule as sign-up (server/utils/validate.js)

// The emailed link is /reset-password#token=… — after "#", so the token is
// never sent to any server when the page loads, nor in a Referer. This page
// reads it once into state, then removes it from the address bar (history
// and screenshots never keep it); it only ever leaves the browser in the
// body of POST /auth/reset-password. Reloading after that has no token any
// more, and says to open the link from the email again.
function readTokenFromHash(hash) {
  const value = new URLSearchParams(hash.replace(/^#/, '')).get('token')
  return value && value.length <= 200 ? value : null
}

export function ResetPassword() {
  const location = useLocation()
  const navigate = useNavigate()
  const [token] = useState(() => readTokenFromHash(location.hash))
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null) // { message, linkProblem }

  // Drop the token from the address bar as soon as it has been read.
  useEffect(() => {
    if (location.hash) navigate({ pathname: location.pathname, search: location.search, hash: '' }, { replace: true })
  }, [location.hash, location.pathname, location.search, navigate])

  // Belt and braces while this page is open: send no Referer at all.
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'referrer'
    meta.content = 'no-referrer'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    if (form.password.length < PASSWORD_MIN_LENGTH) {
      setError({ message: `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự.` })
      return
    }
    if (form.password !== form.confirm) {
      setError({ message: 'Hai mật khẩu không khớp.' })
      return
    }

    setSubmitting(true)
    // If this browser is signed in, its socket is about to be told the
    // session is over too; that must not win over our own message below.
    setOwnSessionEndInFlight(true)
    try {
      await authService.resetPassword({ token, password: form.password })
    } catch (err) {
      setOwnSessionEndInFlight(false)
      setSubmitting(false)
      const data = err.response?.data
      const linkProblem = data?.code === 'RESET_TOKEN_INVALID' || data?.code === 'RESET_TOKEN_EXPIRED'
      setError({ message: data?.message || 'Không thể đặt lại mật khẩu lúc này. Vui lòng thử lại sau.', linkProblem })
      return
    }
    // Every session of the account — this browser's included — is over now.
    endSessionAndLeave('PASSWORD_RESET', { returnHere: false })
  }

  if (!token) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center space-y-6">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Đặt lại mật khẩu</h1>
        <p className="font-body-md text-body-md text-on-surface-variant" role="alert">
          Liên kết không hợp lệ. Hãy mở lại liên kết trong email, hoặc yêu cầu một liên kết mới.
        </p>
        <Link to="/forgot-password" className="inline-block">
          <Button>Gửi lại liên kết</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto py-16 px-4">
      <div className="text-center space-y-2 mb-8">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Đặt lại mật khẩu</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Đặt mật khẩu mới. Sau đó mọi thiết bị sẽ bị đăng xuất.
        </p>
      </div>

      <Card as="form" padding="lg" onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <Alert className="text-center space-y-2">
            <p>{error.message}</p>
            {error.linkProblem && (
              <Link to="/forgot-password" className="inline-block text-primary font-bold hover:underline">
                Gửi lại liên kết
              </Link>
            )}
          </Alert>
        )}

        <Field label="Mật khẩu mới" hint={`Ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`}>
          <Input
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange('password')}
            required
          />
        </Field>

        <Field label="Nhập lại mật khẩu mới">
          <Input
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={handleChange('confirm')}
            required
          />
        </Field>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Đang đặt lại...' : 'Đặt lại mật khẩu'}
        </Button>
      </Card>
    </div>
  )
}

export default ResetPassword
