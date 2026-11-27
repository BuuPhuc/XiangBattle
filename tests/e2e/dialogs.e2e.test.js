// The shared dialogs (src/components/ui/Modal.jsx, ConfirmDialog.jsx) in a
// real bot game: the resign confirm can be backed out of with Escape, a
// backdrop click or "Hủy" (focused when it opens), and the game result
// dialog stays up until it is closed on purpose with "Đóng".
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { openApp, closeApp, step as runStep } from './browser.js'

let app
let page
before(async () => {
  app = await openApp()
  page = app.page
})
after(() => closeApp(app))

const step = (t, fn) => runStep(app, t, fn)
const resignDialog = () => page.getByRole('dialog', { name: 'Bạn có chắc muốn đầu hàng?' })
const resignButton = () => page.getByRole('button', { name: 'Đầu hàng' }).first()

test('start a bot game as Red', (t) =>
  step(t, async () => {
    await page.goto(`${app.baseUrl}/ai`)
    await page.getByText('Đối đầu với máy').waitFor()
    await page.getByRole('button', { name: /^Dễ/ }).click()
    await page.getByRole('button', { name: /Cầm Đỏ/ }).click()
    await page.getByRole('button', { name: /Bắt đầu ván đấu/ }).click()
    await page.getByText('Đến lượt bạn').first().waitFor({ timeout: 8000 })
    assert.equal(await resignButton().isEnabled(), true)
  }))

test('resign confirm: named dialog, "Hủy" focused, Escape cancels', (t) =>
  step(t, async () => {
    await resignButton().click()
    await resignDialog().waitFor()
    const focused = await page.evaluate(() => document.activeElement?.textContent?.trim())
    assert.equal(focused, 'Hủy')
    await page.keyboard.press('Escape')
    await resignDialog().waitFor({ state: 'detached' })
    assert.equal(await page.getByText(/đã đầu hàng/).count(), 0, 'Escape must not resign')
  }))

test('resign confirm: a backdrop click and "Hủy" both cancel', (t) =>
  step(t, async () => {
    await resignButton().click()
    await resignDialog().waitFor()
    await page.mouse.click(10, 10) // the dimmed backdrop, well outside the card
    await resignDialog().waitFor({ state: 'detached' })

    await resignButton().click()
    await resignDialog().getByRole('button', { name: 'Hủy' }).click()
    await resignDialog().waitFor({ state: 'detached' })
    assert.equal(await page.getByText(/đã đầu hàng/).count(), 0)
  }))

test('confirming resigns; the result dialog ignores Escape and closes with "Đóng"', (t) =>
  step(t, async () => {
    await resignButton().click()
    await resignDialog().getByRole('button', { name: 'Đầu hàng' }).click()
    const result = page.getByRole('dialog', { name: 'Bạn đã đầu hàng!' })
    await result.waitFor({ timeout: 3000 })

    await page.keyboard.press('Escape')
    await page.mouse.click(10, 10)
    assert.equal(await result.isVisible(), true, 'the result dialog closed without "Đóng"')

    await result.getByRole('button', { name: 'Đóng' }).click()
    await result.waitFor({ state: 'detached' })
  }))

test('no page errors', (t) =>
  step(t, async () => {
    assert.deepEqual(app.pageErrors, [])
  }))
