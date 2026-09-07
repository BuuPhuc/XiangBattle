const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_MIN_LENGTH = 3
const USERNAME_MAX_LENGTH = 20
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/
const PASSWORD_MIN_LENGTH = 8

function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 254 && EMAIL_REGEX.test(email.trim())
}

function isValidUsername(username) {
  if (typeof username !== 'string') return false
  const trimmed = username.trim()
  return (
    trimmed.length >= USERNAME_MIN_LENGTH &&
    trimmed.length <= USERNAME_MAX_LENGTH &&
    USERNAME_REGEX.test(trimmed)
  )
}

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= PASSWORD_MIN_LENGTH && password.length <= 200
}

module.exports = {
  isValidEmail,
  isValidUsername,
  isValidPassword,
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
}
