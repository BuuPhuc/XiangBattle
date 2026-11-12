// Where Login sends someone back to (?next=): only paths inside this site,
// never another site (open redirect) and never an auth page.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { safeReturnPath, loginPathFor } from '../../src/features/auth/returnPath.js'

test('pages of this site are accepted, with their query and hash', () => {
  assert.equal(safeReturnPath('/friends'), '/friends')
  assert.equal(safeReturnPath('/replay/42'), '/replay/42')
  assert.equal(safeReturnPath('/profile/7?tab=games#x'), '/profile/7?tab=games#x')
})

test('anything else falls back to /play', () => {
  for (const bad of [null, undefined, '', 'friends', '//evil.example.com', '/\\evil.example.com', 'https://evil.example.com', 'javascript:alert(1)']) {
    assert.equal(safeReturnPath(bad), '/play', String(bad))
  }
})

test('never back to an auth page', () => {
  for (const auth of ['/login', '/login?next=/x', '/register', '/verify-email?token=1']) {
    assert.equal(safeReturnPath(auth), '/play', auth)
  }
})

test('loginPathFor encodes the page to come back to', () => {
  assert.equal(loginPathFor('/profile/7?tab=games'), '/login?next=%2Fprofile%2F7%3Ftab%3Dgames')
  assert.equal(safeReturnPath(new URLSearchParams(loginPathFor('/friends').split('?')[1]).get('next')), '/friends')
})
