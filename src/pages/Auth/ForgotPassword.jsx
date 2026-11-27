import { useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import authService from '../../services/authService'

// "Quên mật khẩu?" — asks for the email and shows the server's answer,
// which is the same whether or not that email has an account (so this page
// can't be used to find out who is registered).
export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sentMessage, setSentMessage] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await authService.forgotPassword(email)
      setSentMessage(res.message)
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể gửi yêu cầu lúc này. Vui lòng thử lại sau.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-md mx-auto py-16 px-4">
      <div className="text-center space-y-2 mb-8">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Quên mật khẩu</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Nhập email của tài khoản, chúng tôi sẽ gửi liên kết để đặt lại mật khẩu.
        </p>
      </div>

      {sentMessage ? (
        <Card padding="lg" className="space-y-5 text-center">
          <div
            role="status"
            className="px-4 py-3 rounded-lg bg-secondary/10 border border-secondary/30 text-secondary font-label-md text-label-md"
          >
            {sentMessage}
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Liên kết chỉ dùng được một lần và hết hạn sau 30 phút. Không thấy email? Hãy xem cả thư mục Spam.
          </p>
          <Link to="/login" className="inline-block">
            <Button>Quay lại đăng nhập</Button>
          </Link>
        </Card>
      ) : (
        <Card as="form" padding="lg" onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div
              role="alert"
              className="px-4 py-3 rounded-lg bg-error/10 border border-error/30 text-error font-label-md text-label-md text-center"
            >
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="forgot-email" className="font-label-sm text-label-sm text-on-surface-variant">
              Email
            </label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="player01@gmail.com"
              className="w-full px-4 py-2 rounded-lg border border-outline-variant bg-surface-container focus:outline-none focus:border-primary"
            />
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Đang gửi...' : 'Gửi liên kết đặt lại'}
          </Button>

          <p className="text-center font-label-sm text-label-sm text-on-surface-variant">
            Nhớ ra mật khẩu?{' '}
            <Link to="/login" className="text-primary hover:underline">
              Đăng nhập
            </Link>
          </p>
        </Card>
      )}
    </div>
  )
}

export default ForgotPassword
