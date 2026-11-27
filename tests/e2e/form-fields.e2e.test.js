// The shared form controls (src/components/ui/Input.jsx — Field, Input,
// Textarea — and Alert.jsx) on the real pages, with a faked backend: every
// form box is found by its label (so a screen reader names it), clicking a
// label focuses its box, a hint is read out with the box, and form errors
// are announced as alerts.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { openApp, closeApp, openMockedPage, json } from './browser.js'

let app
before(async () => {
  app = await openApp()
})
after(() => closeApp(app))

const describedText = (locator) =>
  locator.evaluate((el) =>
    (el.getAttribute('aria-describedby') || '')
      .split(' ')
      .filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent.trim())
      .join(' | ')
  )

test('Đăng nhập and Đăng ký: every box is labelled; clicking a label focuses its box', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page } = ctx

  await page.goto(`${app.baseUrl}/login`)
  assert.equal(await page.getByLabel('Email').getAttribute('type'), 'email')
  assert.equal(await page.getByLabel('Mật khẩu').getAttribute('type'), 'password')
  await page.getByText('Mật khẩu', { exact: true }).click()
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('type')), 'password')

  await page.goto(`${app.baseUrl}/register`)
  assert.equal(await page.getByLabel('Tên người dùng').getAttribute('placeholder'), 'player01')
  assert.equal(await page.getByLabel('Email').getAttribute('type'), 'email')
  assert.equal(await page.getByLabel('Mật khẩu').getAttribute('minlength'), '8')
  assert.deepEqual(ctx.errors, [])
})

test('Đăng nhập: a failed sign-in shows the server message as an alert', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page } = ctx
  await page.route(/\/api\/auth\/login(\?|$)/, (route) =>
    route.fulfill(json({ success: false, message: 'Email hoặc mật khẩu không đúng' }, 401))
  )
  await page.goto(`${app.baseUrl}/login`)
  await page.getByLabel('Email').fill('tester@example.com')
  await page.getByLabel('Mật khẩu').fill('wrong-password')
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await page.getByRole('alert').waitFor()
  assert.match(await page.getByRole('alert').innerText(), /không đúng/)
})

test('Đặt lại mật khẩu: the length hint is read out with the new-password box', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page } = ctx
  await page.goto(`${app.baseUrl}/reset-password#token=${'ab'.repeat(32)}`)
  const box = page.getByLabel('Mật khẩu mới', { exact: true })
  await box.waitFor()
  assert.match(await describedText(box), /^Ít nhất \d+ ký tự\.$/)
  assert.equal(await describedText(page.getByLabel('Nhập lại mật khẩu mới')), '')
})

test('Sửa hồ sơ: locked email with its hint, username box, bio box with a live counter', async (t) => {
  const ctx = await openMockedPage(app, t, { user: { id: 7, username: 'tester', email: 'tester@example.com', bio: '' } })
  if (!ctx) return
  const { page } = ctx
  await page.goto(`${app.baseUrl}/profile/edit`)

  const email = page.getByLabel('Email')
  await email.waitFor()
  assert.equal(await email.isDisabled(), true)
  assert.equal(await email.inputValue(), 'tester@example.com')
  assert.equal(await describedText(email), 'Email không thể thay đổi.')

  assert.equal(await page.getByLabel('Tên đăng nhập').inputValue(), 'tester')

  const bio = page.getByLabel('Tiểu sử')
  assert.equal(await bio.evaluate((el) => el.tagName), 'TEXTAREA')
  await bio.fill('Thích chơi pháo đầu')
  await page.getByText(/^19\/\d+$/).waitFor()
  assert.deepEqual(ctx.errors, [])
})

test('search boxes and the room code box have accessible names', async (t) => {
  const ctx = await openMockedPage(app, t)
  if (!ctx) return
  const { page } = ctx
  await page.goto(`${app.baseUrl}/academy`)
  await page.getByRole('textbox', { name: 'Tìm kiếm khóa học' }).waitFor()
  await page.goto(`${app.baseUrl}/room`)
  await page.getByRole('textbox', { name: 'Mã phòng' }).waitFor()
})
