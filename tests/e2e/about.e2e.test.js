// The About page, the Footer's links and the single site name, in Chrome
// with a faked backend (openMockedPage — no server needed).
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { openApp, closeApp, openMockedPage } from './browser.js'

let app
before(async () => {
  app = await openApp()
})
after(() => closeApp(app))

const pathname = (page) => new URL(page.url()).pathname
const footer = (page) => page.locator('footer')

// Whether the element's top is inside the viewport (i.e. scrolled to).
const inView = (page, selector) =>
  page.evaluate((sel) => {
    const r = document.querySelector(sel).getBoundingClientRect()
    return r.top >= 0 && r.top < window.innerHeight
  }, selector)

async function waitInView(page, selector) {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel)
      if (!el) return false
      const r = el.getBoundingClientRect()
      return r.top >= 0 && r.top < window.innerHeight
    },
    selector,
    { timeout: 3000 }
  )
}

test('/about shows every section and the play button', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page, errors } = ctx
  await page.goto(`${app.baseUrl}/about`)
  await page.getByRole('heading', { name: 'Về XiangBattle', level: 1 }).waitFor()
  for (const name of ['Luật riêng của XiangBattle', 'Dữ liệu của bạn', 'Ghi nguồn']) {
    assert.equal(await page.getByRole('heading', { name, level: 2 }).count(), 1, `missing section "${name}"`)
  }
  assert.equal(await page.locator('#luat-choi').count(), 1)
  assert.equal(await page.locator('#du-lieu').count(), 1)
  assert.equal(await page.getByRole('link', { name: 'Impact Sounds — Kenney' }).getAttribute('href'), 'https://kenney.nl/assets/impact-sounds')
  assert.equal(await page.getByText('đang được xây dựng').count(), 0, 'still the placeholder')

  // The page's own button (the top bar has a "Chơi ngay" link too).
  await page.locator('main').getByRole('link', { name: 'Chơi ngay' }).click()
  await page.waitForURL((url) => url.pathname === '/play')
  assert.deepEqual(errors, [])
})

test('Footer: every link goes somewhere real, no "#" links left', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page } = ctx
  await page.goto(`${app.baseUrl}/`)
  await footer(page).waitFor()

  const links = await footer(page).locator('a').evaluateAll((els) => els.map((a) => [a.textContent.trim(), a.getAttribute('href')]))
  assert.deepEqual(links, [
    ['Giới thiệu', '/about'],
    ['Hướng dẫn luật chơi', '/academy'],
    ['Câu hỏi thường gặp', '/about#luat-choi'],
    ['Privacy Policy', '/about#du-lieu'],
  ])
  for (const hidden of ['Support', 'Terms of Service', 'Press Kit']) {
    assert.equal(await footer(page).getByText(hidden, { exact: true }).count(), 0, `"${hidden}" should be hidden`)
  }
})

test('Footer links open the right page / section', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page } = ctx

  await page.goto(`${app.baseUrl}/`)
  await footer(page).getByRole('link', { name: 'Câu hỏi thường gặp' }).click()
  await page.waitForURL((url) => url.pathname === '/about' && url.hash === '#luat-choi')
  await waitInView(page, '#luat-choi')

  // Clicking another section link while already on /about scrolls there too.
  await footer(page).getByRole('link', { name: 'Privacy Policy' }).click()
  await page.waitForURL((url) => url.hash === '#du-lieu')
  await waitInView(page, '#du-lieu')

  // A direct load with the anchor lands on the section as well.
  await page.goto(`${app.baseUrl}/about#luat-choi`)
  await waitInView(page, '#luat-choi')
  assert.equal(await inView(page, '#luat-choi'), true)

  await footer(page).getByRole('link', { name: 'Giới thiệu' }).click()
  await page.waitForURL((url) => url.pathname === '/about' && url.hash === '')
  await page.waitForFunction(() => window.scrollY === 0)

  await footer(page).getByRole('link', { name: 'Hướng dẫn luật chơi' }).click()
  await page.waitForURL((url) => url.pathname === '/academy')
  assert.equal(pathname(page), '/academy')
})

test('one name everywhere: XiangBattle, never "Xiangqi Master"', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page } = ctx
  // textContent (not innerText) so elements hidden at this width — e.g. the
  // mobile top bar — are checked too.
  for (const path of ['/', '/about', '/play', '/game']) {
    await page.goto(`${app.baseUrl}${path}`)
    await page.waitForLoadState('networkidle')
    assert.equal(await page.title(), 'XiangBattle - Chơi Cờ Tướng Online', `title on ${path}`)
    const text = await page.evaluate(() => document.body.textContent)
    assert.ok(!/Xiangqi Master/i.test(text), `old name still shown on ${path}`)
    assert.ok(text.includes('XiangBattle'), `XiangBattle not shown on ${path}`)
  }
  // On the board itself (the river label).
  assert.equal(await page.locator('.river-domain').textContent(), 'XiangBattle')
})

test('top bar of the public pages is in Vietnamese', async (t) => {
  const ctx = await openMockedPage(app, t, { signedIn: false })
  if (!ctx) return
  const { page } = ctx
  await page.goto(`${app.baseUrl}/about`)
  const nav = page.locator('nav').first()
  assert.equal(await nav.getByRole('link', { name: 'Đăng nhập', exact: true }).getAttribute('href'), '/login')
  assert.equal(await nav.getByRole('link', { name: 'Chơi ngay', exact: true }).getAttribute('href'), '/play')
  assert.equal(await nav.getByText(/Sign In|Start Match/).count(), 0)
})
