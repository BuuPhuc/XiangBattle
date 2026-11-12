// The Settings page for guests and signed-in users, in Chrome with a faked
// backend (see openMockedPage in ./browser.js — no server, database or real
// account involved).
//
// Covers: a guest sees only the sound switch, it survives a reload, and no
// settings API is ever called for them; guest and account settings never
// overwrite each other across sign-in / sign-out; a signed-in user's Lưu
// takes effect immediately (no reload) for both sound and arrow drawing.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  openApp,
  closeApp,
  openMockedPage,
  clickSquare,
  soundsPlayed,
  navigateInApp,
  rightDrag,
  contextMenuBlocked,
  DEFAULT_TEST_SETTINGS,
} from './browser.js'

let app
before(async () => {
  app = await openApp()
})
after(() => closeApp(app))

const pathname = (page) => new URL(page.url()).pathname
const soundSwitch = (page) => page.getByRole('switch', { name: 'Âm thanh' })
const arrowsSwitch = (page) => page.getByRole('switch', { name: 'Vẽ mũi tên và đánh dấu' })
const isOn = async (locator) => (await locator.getAttribute('aria-checked')) === 'true'

async function saveAndConfirm(page) {
  await page.getByRole('button', { name: 'Lưu', exact: true }).click()
  await page.getByText('Đã lưu thay đổi').waitFor()
}

// Signs out through the app itself (sidebar → confirm), like a person would.
async function signOutInApp(page) {
  await page.getByText('Đăng xuất', { exact: true }).first().click()
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).last().click()
}

test('guest: only the sound switch, saved across a reload, and no settings API call', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page, settingsCalls, errors } = ctx

  await page.goto(`${app.baseUrl}/settings`)
  await soundSwitch(page).waitFor()
  assert.equal(pathname(page), '/settings', 'a guest was redirected away from /settings')
  assert.equal(await arrowsSwitch(page).count(), 0, 'guest should not see the arrows switch')
  assert.equal(await page.getByText('Ván đấu gần đây').count(), 0)
  assert.equal(await page.getByText('Ai có thể thách đấu tôi').count(), 0)
  assert.equal(await page.locator('select').count(), 0)
  assert.equal(await isOn(soundSwitch(page)), true, 'sound should default to on')

  await soundSwitch(page).click()
  await saveAndConfirm(page)
  await page.reload()
  await soundSwitch(page).waitFor()
  assert.equal(await isOn(soundSwitch(page)), false, 'guest sound setting was not kept after reload')

  assert.deepEqual(settingsCalls, [], 'a guest must never call the settings API')
  assert.deepEqual(errors, [])
})

test('guest and account settings never overwrite each other', async (t) => {
  // Starts signed in; the account has sound ON.
  const ctx = await openMockedPage(app, t, { signedIn: true, settings: { ...DEFAULT_TEST_SETTINGS, soundEnabled: true } })
  if (!ctx) return
  const { page, settingsCalls } = ctx
  // This browser's guest setting is OFF (as if saved by a guest earlier).
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('xiangbattle_guest_settings', JSON.stringify({ soundEnabled: false }))
      sessionStorage.setItem('seeded', '1')
    }
  })

  await page.goto(`${app.baseUrl}/settings`)
  await arrowsSwitch(page).waitFor()
  assert.equal(await isOn(soundSwitch(page)), true, 'signed in: should show the account value, not the guest one')

  // Change the ACCOUNT's sound to off and back on; the guest value must stay.
  await soundSwitch(page).click()
  await saveAndConfirm(page)
  assert.deepEqual(settingsCalls.at(-1), { method: 'PATCH', body: { soundEnabled: false } })
  const guestStored = await page.evaluate(() => localStorage.getItem('xiangbattle_guest_settings'))
  assert.deepEqual(JSON.parse(guestStored), { soundEnabled: false }, 'account save touched the guest setting')

  await signOutInApp(page)
  await navigateInApp(page, '/settings')
  await soundSwitch(page).waitFor()
  assert.equal(await arrowsSwitch(page).count(), 0, 'after sign-out the guest page should show')
  assert.equal(await isOn(soundSwitch(page)), false, 'after sign-out: back to the guest value')

  // And the guest turning sound ON doesn't send anything to the account.
  const callsBefore = settingsCalls.length
  await soundSwitch(page).click()
  await saveAndConfirm(page)
  assert.equal(settingsCalls.length, callsBefore, 'guest save called the settings API')
})

test('signed in: Lưu takes effect immediately (no reload) for sound and arrows', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: true, sounds: true })
  if (!ctx) return
  const { page, settingsCalls, errors } = ctx

  await page.goto(`${app.baseUrl}/settings`)
  await arrowsSwitch(page).waitFor()
  await page.evaluate(() => {
    window.__sameDocument = true
  })

  await soundSwitch(page).click()
  await arrowsSwitch(page).click()
  await saveAndConfirm(page)
  assert.deepEqual(settingsCalls.at(-1), { method: 'PATCH', body: { soundEnabled: false, arrowsEnabled: false } })

  await navigateInApp(page, '/game')
  await page.locator('.piece').first().waitFor()

  // Sound off: a move plays nothing.
  await clickSquare(page, 1, 7)
  await clickSquare(page, 4, 7)
  await page.locator('.last-move-to').waitFor()
  await page.waitForTimeout(300)
  assert.deepEqual(await soundsPlayed(page), [], 'sound played although it was just switched off')

  // Arrows off: right-drag draws nothing, and the browser menu is not blocked.
  await rightDrag(page, [1, 9], [2, 7])
  assert.equal(await page.locator('[data-drawing]').count(), 0, 'drew although arrows were just switched off')
  assert.equal(await contextMenuBlocked(page), false, 'context menu blocked with drawing off')

  assert.equal(await page.evaluate(() => window.__sameDocument), true, 'the page reloaded')
  assert.deepEqual(errors, [])
})
