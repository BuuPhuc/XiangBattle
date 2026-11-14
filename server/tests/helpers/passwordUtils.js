// bcrypt hashing for test fixtures — the same library and the same format
// utils/password.js produces, so comparePassword (what login uses) accepts it.
const bcrypt = require('bcryptjs')

function hashPasswordSync(plain) {
  return bcrypt.hashSync(plain, 4) // low cost: fixtures only
}

module.exports = { hashPasswordSync }
