// The shared list of time controls (src/features/game/timeControls.js) that
// both the picker and the server referee read.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TIME_CONTROLS,
  DEFAULT_TIME_CONTROL_ID,
  getTimeControl,
  isTimeControlId,
  findTimeControlBySeconds,
  formatTimeControlShort,
  formatTimeControlLabel,
  describeTimeControl,
  formatSavedTimeControl,
} from '../../src/features/game/timeControls.js'

const MINUTE = 60_000

test('the four presets agreed with the owner', () => {
  assert.deepEqual(
    TIME_CONTROLS.map((c) => [c.id, c.gameTimeMs / MINUTE, c.moveTimeMs / MINUTE, c.incrementMs / 1000]),
    [
      ['5+0', 5, 1, 0],
      ['10+0', 10, 2, 0],
      ['15+5', 15, 2, 5],
      ['20+5', 20, 5, 5],
    ]
  )
  assert.equal(DEFAULT_TIME_CONTROL_ID, '10+0')
})

test('unknown ids fall back to the default', () => {
  for (const id of [undefined, null, '', '10', '99+0', 10, {}, '__proto__', 'toString']) {
    assert.equal(isTimeControlId(id), false, String(id))
    assert.equal(getTimeControl(id).id, '10+0', String(id))
  }
  assert.equal(getTimeControl('20+5').id, '20+5')
})

test('labels', () => {
  const [five, , fifteen] = TIME_CONTROLS
  assert.equal(formatTimeControlShort(five), '5 + 0')
  assert.equal(formatTimeControlShort(fifteen), '15 + 5')
  assert.equal(formatTimeControlLabel(five), '5 phút')
  assert.equal(formatTimeControlLabel(fifteen), '15 phút + 5 giây')
  assert.equal(describeTimeControl(five), 'Mỗi bên có 5 phút, tối đa 1 phút cho một nước.')
  assert.equal(describeTimeControl(fifteen), 'Mỗi bên có 15 phút, cộng 5 giây sau mỗi nước, tối đa 2 phút cho một nước.')
})

test('a saved game (seconds) maps back to its preset and label', () => {
  assert.equal(findTimeControlBySeconds(900, 5).id, '15+5')
  assert.equal(findTimeControlBySeconds(600, 0).id, '10+0')
  assert.equal(findTimeControlBySeconds(600, null).id, '10+0')
  assert.equal(findTimeControlBySeconds(420, 0), null)
  assert.equal(formatSavedTimeControl(900, 5), '15 + 5')
  assert.equal(formatSavedTimeControl(600, 0), '10 + 0')
  assert.equal(formatSavedTimeControl(undefined, undefined), null)
  assert.equal(formatSavedTimeControl(0, 0), null)
})
