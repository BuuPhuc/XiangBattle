const { db } = require('../prisma/db')
const { hashPassword, comparePassword } = require('../utils/password')
const { createVerificationToken, hashVerificationToken, signAccessToken } = require('../utils/token')
const { sendVerificationEmail } = require('../utils/mailer')
const { revokeAllSessions } = require('../services/sessionService')
const { isValidEmail, isValidUsername, isValidPassword, PASSWORD_MIN_LENGTH } = require('../utils/validate')

// This contract has a single namespace, but the installed runtime only
// resolves ORM models through the namespace-qualified accessor
// (`db.orm.public.<Model>`) — the flat `db.orm.<Model>` form documented for
// single-namespace contracts resolves to `undefined` on this build.
const User = db.orm.public.User
const EmailVerificationToken = db.orm.public.EmailVerificationToken

const RESEND_COOLDOWN_SECONDS = Number(process.env.RESEND_VERIFICATION_COOLDOWN_SECONDS || 60)

// Never leak passwordHash (or the raw verification token) back to a client.
function toPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    emailVerified: user.emailVerified,
    rating: user.rating,
    wins: user.wins,
    losses: user.losses,
    draws: user.draws,
    createdAt: user.createdAt,
  }
}

// Wraps a handler so an unexpected failure (DB unreachable, etc.) reaches
// the client as a generic message instead of a leaked stack trace.
function withErrorHandling(handler) {
  return async (req, res) => {
    try {
      await handler(req, res)
    } catch (error) {
      console.error('[auth] unexpected error:', error.message)
      res.status(503).json({
        success: false,
        code: 'SERVICE_UNAVAILABLE',
        message: 'Đã có lỗi xảy ra. Vui lòng thử lại sau.',
      })
    }
  }
}

const register = withErrorHandling(async (req, res) => {
  const { username, email, password } = req.body || {}

  if (!isValidUsername(username)) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_USERNAME',
      message: 'Tên người dùng phải từ 3-20 ký tự, chỉ gồm chữ cái, số và dấu gạch dưới.',
    })
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, code: 'INVALID_EMAIL', message: 'Email không hợp lệ.' })
  }
  if (!isValidPassword(password)) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_PASSWORD',
      message: `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự.`,
    })
  }

  const trimmedUsername = username.trim()
  const trimmedEmail = email.trim().toLowerCase()

  const [existingUsername, existingEmail] = await Promise.all([
    User.first({ username: trimmedUsername }),
    User.first({ email: trimmedEmail }),
  ])
  if (existingUsername) {
    return res.status(409).json({ success: false, code: 'USERNAME_TAKEN', message: 'Tên người dùng đã được sử dụng.' })
  }
  if (existingEmail) {
    return res.status(409).json({ success: false, code: 'EMAIL_TAKEN', message: 'Email đã được sử dụng.' })
  }

  const passwordHash = await hashPassword(password)
  const { rawToken, tokenHash, expiresAt } = createVerificationToken()

  let user
  try {
    user = await db.transaction(async (tx) => {
      const created = await tx.orm.public.User.create({
        username: trimmedUsername,
        email: trimmedEmail,
        passwordHash,
        emailVerified: false,
      })
      await tx.orm.public.EmailVerificationToken.create({
        userId: created.id,
        tokenHash,
        expiresAt,
      })
      return created
    })
  } catch (error) {
    console.error('[auth] register transaction failed:', error.message)
    return res.status(409).json({
      success: false,
      code: 'REGISTRATION_FAILED',
      message: 'Không thể tạo tài khoản. Tên người dùng hoặc email có thể đã được sử dụng.',
    })
  }

  // The account exists in Postgres regardless of whether the email actually
  // went out — resend-verification is the recovery path when it didn't, so
  // a flaky SMTP provider never leaves the user stuck.
  let emailSent = false
  try {
    const result = await sendVerificationEmail({ to: trimmedEmail, username: trimmedUsername, rawToken })
    emailSent = result.sent
  } catch (error) {
    console.error('[auth] failed to send verification email:', error.message)
  }

  return res.status(201).json({
    success: true,
    message: emailSent
      ? 'Đăng ký thành công. Vui lòng kiểm tra email để xác nhận tài khoản.'
      : 'Đăng ký thành công nhưng email xác nhận chưa gửi được. Vui lòng dùng chức năng gửi lại.',
    emailSent,
    email: trimmedEmail,
    user: toPublicUser(user),
  })
})

const login = withErrorHandling(async (req, res) => {
  const { email, password } = req.body || {}

  if (!isValidEmail(email) || typeof password !== 'string' || !password) {
    return res.status(400).json({ success: false, code: 'INVALID_INPUT', message: 'Email hoặc mật khẩu không hợp lệ.' })
  }

  const trimmedEmail = email.trim().toLowerCase()
  const user = await User.first({ email: trimmedEmail })

  if (!user || !(await comparePassword(password, user.passwordHash))) {
    return res.status(401).json({ success: false, code: 'INVALID_CREDENTIALS', message: 'Email hoặc mật khẩu không đúng.' })
  }

  if (!user.emailVerified) {
    return res.status(403).json({
      success: false,
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Vui lòng xác nhận email trước khi đăng nhập.',
    })
  }

  const token = signAccessToken(user)
  return res.json({ success: true, token, user: toPublicUser(user) })
})

const verifyEmail = withErrorHandling(async (req, res) => {
  const { token } = req.query

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ success: false, code: 'INVALID_TOKEN', message: 'Liên kết xác nhận không hợp lệ.' })
  }

  const tokenHash = hashVerificationToken(token)
  const record = await EmailVerificationToken.first({ tokenHash })

  if (!record || record.consumedAt) {
    return res.status(400).json({ success: false, code: 'INVALID_TOKEN', message: 'Liên kết xác nhận không hợp lệ.' })
  }

  if (new Date(record.expiresAt).getTime() < Date.now()) {
    const user = await User.first({ id: record.userId })
    return res.status(400).json({
      success: false,
      code: 'TOKEN_EXPIRED',
      message: 'Liên kết xác nhận đã hết hạn.',
      email: user ? user.email : null,
    })
  }

  await db.transaction(async (tx) => {
    await tx.orm.public.User.where({ id: record.userId }).update({ emailVerified: true })
    await tx.orm.public.EmailVerificationToken.where({ id: record.id }).update({ consumedAt: new Date() })
  })

  return res.json({ success: true, message: 'Xác nhận email thành công. Tài khoản của bạn đã được kích hoạt.' })
})

const resendVerification = withErrorHandling(async (req, res) => {
  const { email } = req.body || {}

  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, code: 'INVALID_EMAIL', message: 'Email không hợp lệ.' })
  }

  const trimmedEmail = email.trim().toLowerCase()
  // Same response whether the email doesn't exist or is already verified —
  // never lets this endpoint be used to probe which emails have accounts.
  const genericResponse = {
    success: true,
    message: 'Nếu email tồn tại và chưa được xác thực, một email xác nhận mới đã được gửi.',
  }

  const user = await User.first({ email: trimmedEmail })
  if (!user || user.emailVerified) {
    return res.json(genericResponse)
  }

  const lastToken = await EmailVerificationToken
    .where({ userId: user.id })
    .orderBy((t) => t.createdAt.desc())
    .first()

  if (lastToken) {
    const secondsSinceLast = (Date.now() - new Date(lastToken.createdAt).getTime()) / 1000
    if (secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
      return res.status(429).json({
        success: false,
        code: 'RATE_LIMITED',
        message: 'Vui lòng chờ trước khi yêu cầu gửi lại email xác nhận.',
        retryAfterSeconds: Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceLast),
      })
    }
  }

  const { rawToken, tokenHash, expiresAt } = createVerificationToken()
  await EmailVerificationToken.create({ userId: user.id, tokenHash, expiresAt })

  try {
    await sendVerificationEmail({ to: user.email, username: user.username, rawToken })
  } catch (error) {
    console.error('[auth] failed to resend verification email:', error.message)
    return res.status(502).json({
      success: false,
      code: 'EMAIL_SEND_FAILED',
      message: 'Không thể gửi email xác nhận, vui lòng thử lại sau.',
    })
  }

  return res.json(genericResponse)
})

const me = withErrorHandling(async (req, res) => {
  const user = await User.first({ id: req.auth.userId })
  if (!user) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Không tìm thấy người dùng.' })
  }
  return res.json({ success: true, user: toPublicUser(user) })
})

// "Đăng xuất khỏi tất cả thiết bị". Acts only on the signed-in account —
// the id comes from the verified JWT (req.auth), never from the body,
// query or params, so it can't be pointed at anyone else. The caller's own
// token is revoked too: the client signs itself out on the 200.
const logoutAll = withErrorHandling(async (req, res) => {
  const revoked = await revokeAllSessions(req.auth.userId)
  if (!revoked) {
    return res.status(401).json({ success: false, code: 'INVALID_TOKEN', message: 'Token không hợp lệ.' })
  }
  return res.json({ success: true, message: 'Đã đăng xuất khỏi tất cả thiết bị.' })
})

module.exports = { register, login, verifyEmail, resendVerification, me, logoutAll, toPublicUser }
