const bcrypt = require('bcryptjs')

const SALT_ROUNDS = 10

function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS)
}

function comparePassword(plainPassword, passwordHash) {
  if (!passwordHash) return Promise.resolve(false)
  return bcrypt.compare(plainPassword, passwordHash)
}

module.exports = { hashPassword, comparePassword }
