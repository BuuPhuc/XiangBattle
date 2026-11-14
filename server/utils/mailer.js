const nodemailer = require('nodemailer')

const APP_NAME = process.env.APP_NAME || 'XiangBattle'
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'
const EMAIL_FROM = process.env.EMAIL_FROM || `${APP_NAME} <no-reply@xiangbattle.local>`

let cachedTransporter = null
let smtpConfigured = null

function isSmtpConfigured() {
  if (smtpConfigured === null) {
    smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD)
  }
  return smtpConfigured
}

function getTransporter() {
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })
  }
  return cachedTransporter
}

function buildVerificationUrl(rawToken) {
  return `${CLIENT_URL}/verify-email?token=${encodeURIComponent(rawToken)}`
}

function buildVerificationEmailHtml({ username, verificationUrl }) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>${APP_NAME}</h2>
      <p>Xin chào ${username},</p>
      <p>Cảm ơn bạn đã đăng ký ${APP_NAME}.</p>
      <p>Vui lòng xác nhận email bằng cách nhấn nút bên dưới:</p>
      <p>
        <a href="${verificationUrl}" style="display:inline-block;padding:12px 24px;background:#8B5E3C;color:#fff;text-decoration:none;border-radius:8px;">
          XÁC NHẬN EMAIL
        </a>
      </p>
      <p>Nếu bạn không thực hiện đăng ký này, hãy bỏ qua email.</p>
      <p>Trân trọng,<br/>${APP_NAME}</p>
    </div>
  `
}

// Sends the verification email when SMTP credentials are configured in
// .env. Without them (a fresh local checkout), this logs the verification
// link to the console instead of throwing, so registration/resend can
// still be exercised end-to-end without setting up a real mail provider —
// the caller still learns whether an actual email went out via `sent`.
async function sendVerificationEmail({ to, username, rawToken }) {
  const verificationUrl = buildVerificationUrl(rawToken)

  if (!isSmtpConfigured()) {
    console.warn(`[mailer] SMTP not configured — verification link for ${to}: ${verificationUrl}`)
    return { sent: false, verificationUrl }
  }

  await getTransporter().sendMail({
    from: EMAIL_FROM,
    to,
    subject: `Xác nhận email đăng ký ${APP_NAME}`,
    html: buildVerificationEmailHtml({ username, verificationUrl }),
  })

  return { sent: true, verificationUrl }
}

// --- Password reset ------------------------------------------------------
//
// The token travels after "#" (a URL fragment): browsers never send that
// part to any server — not to ours when the page loads, not in a Referer —
// so it can't end up in a web server's access log. Email verification keeps
// its ?token= link unchanged.
function buildPasswordResetUrl(rawToken) {
  return `${CLIENT_URL}/reset-password#token=${encodeURIComponent(rawToken)}`
}

function buildPasswordResetEmailHtml({ username, resetUrl, expiresInMinutes }) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>${APP_NAME}</h2>
      <p>Xin chào ${username},</p>
      <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản ${APP_NAME} của bạn.</p>
      <p>Nhấn nút bên dưới để đặt mật khẩu mới. Liên kết chỉ dùng được một lần và hết hạn sau ${expiresInMinutes} phút.</p>
      <p>
        <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#8B5E3C;color:#fff;text-decoration:none;border-radius:8px;">
          ĐẶT LẠI MẬT KHẨU
        </a>
      </p>
      <p>Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này — mật khẩu của bạn sẽ không thay đổi.</p>
      <p>Trân trọng,<br/>${APP_NAME}</p>
    </div>
  `
}

// What to log when no SMTP is configured, so the reset link never reaches a
// log in production: only a local / dev run (NODE_ENV other than
// "production") gets the link itself — the only way to try the flow there
// without a mail provider, same idea as sendVerificationEmail above.
function unsentPasswordResetLog({ to, resetUrl, nodeEnv }) {
  if (nodeEnv === 'production') {
    return `[mailer] SMTP not configured — password reset email for ${to} was not sent`
  }
  return `[mailer] SMTP not configured (dev) — password reset link for ${to}: ${resetUrl}`
}

// Returns { sent }. Never returns or logs the token otherwise.
async function sendPasswordResetEmail({ to, username, rawToken, expiresInMinutes }) {
  const resetUrl = buildPasswordResetUrl(rawToken)

  if (!isSmtpConfigured()) {
    console.warn(unsentPasswordResetLog({ to, resetUrl, nodeEnv: process.env.NODE_ENV }))
    return { sent: false }
  }

  await getTransporter().sendMail({
    from: EMAIL_FROM,
    to,
    subject: `Đặt lại mật khẩu ${APP_NAME}`,
    html: buildPasswordResetEmailHtml({ username, resetUrl, expiresInMinutes }),
  })
  return { sent: true }
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  buildPasswordResetUrl,
  unsentPasswordResetLog,
  isSmtpConfigured,
}
