import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Icon from '../../components/ui/Icon'
import Button from '../../components/ui/Button'
import authService from '../../services/authService'

// Renders whichever of the three outcomes verify-email actually reaches —
// success, expired (with the email the backend still safely reveals for a
// token that at least once belonged to someone, so resend can be prefilled),
// or invalid (token malformed / already used / never existed).
export function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  // No token in the URL at all is a render-time fact, not something an
  // effect needs to discover — deriving the initial state from it avoids a
  // synchronous setState inside the effect below.
  const [state, setState] = useState(() => (token ? 'verifying' : 'invalid')) // 'verifying' | 'success' | 'expired' | 'invalid'
  const [email, setEmail] = useState(null)
  const [resendStatus, setResendStatus] = useState('idle')
  const [resendMessage, setResendMessage] = useState(null)

  const ranRef = useRef(false)
  useEffect(() => {
    if (!token || ranRef.current) return
    ranRef.current = true

    authService
      .verifyEmail(token)
      .then(() => setState('success'))
      .catch((error) => {
        const data = error.response?.data
        if (data?.code === 'TOKEN_EXPIRED') {
          setState('expired')
          setEmail(data.email || null)
        } else {
          setState('invalid')
        }
      })
  }, [token])

  const handleResend = async () => {
    if (!email) return
    setResendStatus('sending')
    setResendMessage(null)
    try {
      const res = await authService.resendVerification(email)
      setResendStatus('sent')
      setResendMessage(res.message)
    } catch (error) {
      setResendStatus('error')
      setResendMessage(error.response?.data?.message || 'Không thể gửi lại email xác nhận.')
    }
  }

  if (state === 'verifying') {
    return (
      <div className="max-w-md mx-auto py-24 px-4 text-center space-y-3">
        <span className="w-3 h-3 rounded-full bg-secondary animate-pulse inline-block" />
        <p className="font-body-md text-body-md text-on-surface-variant">Đang xác nhận email...</p>
      </div>
    )
  }

  if (state === 'success') {
    return (
      <div className="max-w-md mx-auto py-24 px-4 text-center space-y-6">
        <Icon name="check_circle" className="text-6xl text-primary" />
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Xác nhận email thành công!</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">Tài khoản của bạn đã được kích hoạt.</p>
        <Link to="/login">
          <Button>Đăng nhập</Button>
        </Link>
      </div>
    )
  }

  if (state === 'expired') {
    return (
      <div className="max-w-md mx-auto py-24 px-4 text-center space-y-6">
        <Icon name="schedule" className="text-6xl text-error" />
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Liên kết xác nhận đã hết hạn</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">Vui lòng gửi lại email xác nhận.</p>

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

        {email && (
          <Button variant="outline" onClick={handleResend} disabled={resendStatus === 'sending'}>
            {resendStatus === 'sending' ? 'Đang gửi...' : 'Gửi lại email xác nhận'}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto py-24 px-4 text-center space-y-6">
      <Icon name="error" className="text-6xl text-error" />
      <h1 className="font-headline-lg text-headline-lg text-on-surface">Liên kết xác nhận không hợp lệ</h1>
      <Link to="/register" className="font-label-md text-label-md text-primary hover:underline">
        Quay lại đăng ký
      </Link>
    </div>
  )
}

export default VerifyEmail
