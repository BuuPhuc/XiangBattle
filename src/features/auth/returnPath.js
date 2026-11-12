// Where to go back to after signing in: a private page sends a guest to
// /login?next=<that page>, and Login returns there once signed in. Only a
// path inside this site is accepted — never "//other-site.com" or a full URL
// (an open redirect) — and never an auth page itself.
const AUTH_PAGES = ['/login', '/register', '/verify-email']

export function safeReturnPath(next, fallback = '/play') {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback
  const pathname = next.split(/[?#]/)[0]
  if (AUTH_PAGES.includes(pathname)) return fallback
  return next
}

export function loginPathFor(returnTo) {
  return `/login?next=${encodeURIComponent(returnTo)}`
}
