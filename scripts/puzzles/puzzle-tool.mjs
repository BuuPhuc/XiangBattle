#!/usr/bin/env node
// Cờ thế dev tool — finds new puzzle candidates and checks existing ones,
// with the app's own rules and solver. Dev-only; never part of the site.
//
//   npm run puzzles:check
//       Re-validates every puzzle in src/features/puzzles/data/puzzles.js
//       (legal position, forced mate in exactly N, nothing faster, one key
//       move, ends in real checkmate, piece limits) and prints quality notes.
//       Read-only. Exits with 1 if any puzzle fails a hard requirement.
//
//   npm run puzzles:find -- --moves 2 [--count 5] [--seed 1] [--black]
//                           [--max-tries 200000] [--loose] [--out file.json]
//       Searches random positions for new candidates and prints them (board,
//       solution, a ready-to-paste data line). By default only "strict"
//       candidates are kept: every attacking piece is needed, no idle
//       defenders, no pawn on the back rank, attackers near the target.
//       --loose drops those quality filters (hard requirements always stay).
//       --black turns each candidate into a Black-to-move puzzle.
//       Output goes to the terminal, or to --out; it NEVER writes into
//       src/features/puzzles/data — adding a puzzle to the site is always a
//       deliberate, reviewed edit of puzzles.js.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PUZZLES } from '../../src/features/puzzles/data/puzzles.js'
import { validate, quality, notate, toPieces, mirror, asDataLine, asciiBoard, titleFor, NAME } from './lib.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const PROTECTED_DIR = path.join(ROOT, 'src', 'features', 'puzzles', 'data')

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) args._.push(a)
    else if (['--black', '--loose'].includes(a)) args[a.slice(2)] = true
    else args[a.slice(2)] = argv[++i]
  }
  return args
}

const describe = (p) => `${NAME[p.type]}(${p.col},${p.row})`

function check() {
  let failed = 0
  for (const puzzle of PUZZLES) {
    const pieces = toPieces(puzzle.pieces)
    const { problems, line } = validate(pieces, puzzle.toMove, puzzle.moves)
    if (problems.length) {
      failed++
      console.log(`✖ ${puzzle.id} ${puzzle.title}: ${problems.join('; ')}`)
      continue
    }
    const q = quality(pieces, puzzle.toMove, puzzle.moves)
    const notes = [
      q.superfluousAttackers.length && `quân công thừa: ${q.superfluousAttackers.map(describe).join(', ')}`,
      q.idleDefenders.length && `quân thủ không tác dụng: ${q.idleDefenders.map(describe).join(', ')}`,
      q.backRankPawns.length && `Tốt ở hàng cuối: ${q.backRankPawns.map(describe).join(', ')}`,
    ].filter(Boolean)
    console.log(
      `✔ ${puzzle.id} ${puzzle.title} (${puzzle.toMove === 'red' ? 'Đỏ' : 'Đen'} đi, ${pieces.length} quân, nước đầu ${q.keyIsCheck ? 'chiếu' : 'im lặng'}): ${notate(pieces, line)}${notes.length ? `\n    ⚠ ${notes.join(' · ')}` : ''}`
    )
  }
  console.log(`\n${PUZZLES.length - failed}/${PUZZLES.length} puzzles meet every hard requirement.`)
  if (failed) process.exitCode = 1
}

// --- random candidate search ------------------------------------------------
const BLACK_ADVISOR = [[3, 0], [5, 0], [4, 1], [3, 2], [5, 2]]
const BLACK_ELEPHANT = [[2, 0], [6, 0], [0, 2], [4, 2], [8, 2], [2, 4], [6, 4]]
const RED_ADVISOR = BLACK_ADVISOR.map(([c, r]) => [c, 9 - r])
const ATTACK_SETS = {
  1: [['rook', 'horse'], ['rook', 'cannon'], ['horse', 'cannon'], ['rook', 'pawn'], ['cannon', 'cannon'], ['horse', 'horse'], ['rook', 'rook'], ['horse', 'pawn'], ['cannon', 'pawn']],
  2: [['rook', 'horse'], ['rook', 'cannon'], ['horse', 'cannon'], ['rook', 'rook'], ['horse', 'horse'], ['cannon', 'cannon'], ['rook', 'pawn'], ['horse', 'pawn'], ['horse', 'cannon', 'pawn']],
  3: [['rook', 'horse'], ['rook', 'cannon'], ['horse', 'cannon'], ['horse', 'horse'], ['rook', 'pawn'], ['horse', 'cannon', 'pawn'], ['cannon', 'cannon', 'horse'], ['rook', 'rook']],
}

function makeRandom(seed) {
  let s = seed >>> 0 || 1
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x80000000)
}

// Red attacks, Black defends (mirror() makes the Black-to-move version).
function randomPosition(rnd, moves, strict) {
  const pick = (a) => a[Math.floor(rnd() * a.length)]
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1))
  const list = []
  const used = new Set()
  const put = (side, type, [col, row]) => {
    if (used.has(col * 10 + row)) return false
    used.add(col * 10 + row)
    list.push({ side, type, col, row })
    return true
  }
  const tryPut = (side, type, squareFn) => {
    for (let k = 0; k < 30; k++) if (put(side, type, squareFn())) return true
    return false
  }
  const count = (side, type) => list.filter((p) => p.side === side && p.type === type).length

  tryPut('black', 'general', () => [int(3, 5), int(0, 2)])
  tryPut('red', 'general', () => [int(3, 5), int(7, 9)])
  const target = list[0]
  // Strict: attackers start within reach of the defending general.
  const near = () => {
    const col = Math.max(0, Math.min(8, target.col + int(-4, 4)))
    const row = Math.max(0, Math.min(6, target.row + int(0, 5)))
    return [col, row]
  }
  for (const type of pick(ATTACK_SETS[moves])) {
    tryPut('red', type, type === 'pawn' ? () => [int(0, 8), int(0, strict ? 3 : 4)] : strict ? near : () => [int(0, 8), int(0, 6)])
  }
  if (rnd() < 0.35) tryPut('red', 'advisor', () => pick(RED_ADVISOR))
  // Defence: palace guards on their own squares, plus at most two active pieces.
  const guards = int(0, 3)
  for (let i = 0; i < guards; i++) {
    const type = rnd() < 0.55 ? 'advisor' : 'elephant'
    if (count('black', type) < 2) tryPut('black', type, () => pick(type === 'advisor' ? BLACK_ADVISOR : BLACK_ELEPHANT))
  }
  const actives = strict ? int(0, 2) : int(0, 3)
  for (let i = 0; i < actives; i++) {
    const type = pick(['rook', 'horse', 'cannon', 'pawn'])
    if (count('black', type) < (type === 'pawn' ? 5 : 2)) {
      tryPut('black', type, type === 'pawn' ? () => [int(0, 8), int(5, strict ? 8 : 9)] : () => [int(0, 8), int(0, 6)])
    }
  }
  return list
}

function find(args) {
  const moves = Number(args.moves)
  if (![1, 2, 3].includes(moves)) throw new Error('--moves must be 1, 2 or 3')
  const want = Number(args.count ?? 5)
  const maxTries = Number(args['max-tries'] ?? 200000)
  const strict = !args.loose
  const rnd = makeRandom(Number(args.seed ?? Date.now() % 100000))
  if (args.out) {
    const out = path.resolve(args.out)
    if (out.startsWith(PROTECTED_DIR + path.sep) || out === PROTECTED_DIR) {
      throw new Error(`refusing to write into ${path.relative(ROOT, PROTECTED_DIR)} — review candidates, then edit puzzles.js by hand`)
    }
  }

  const found = []
  const seen = new Set()
  const started = Date.now()
  let tries = 0
  while (found.length < want && tries < maxTries) {
    tries++
    let list = randomPosition(rnd, moves, strict)
    const pieces = toPieces(list)
    const { problems, line } = validate(pieces, 'red', moves)
    if (problems.length) continue
    if (strict) {
      const q = quality(pieces, 'red', moves)
      if (q.superfluousAttackers.length || q.idleDefenders.length || q.backRankPawns.length) continue
    }
    const key = JSON.stringify([...list].sort((a, b) => a.col - b.col || a.row - b.row || a.type.localeCompare(b.type)))
    if (seen.has(key)) continue
    seen.add(key)

    let toMove = 'red'
    let finalLine = line
    if (args.black) {
      list = mirror(list)
      toMove = 'black'
      finalLine = validate(toPieces(list), 'black', moves).line
    }
    const finalPieces = toPieces(list)
    const q = quality(finalPieces, toMove, moves)
    found.push({
      moves,
      toMove,
      title: titleFor(finalPieces, toMove),
      pieces: list,
      solution: notate(finalPieces, finalLine),
      keyIsCheck: q.keyIsCheck,
      dataLine: asDataLine(`new-${moves}-${found.length + 1}`, moves, toMove, list),
    })
    console.error(`found ${found.length}/${want} after ${tries} tries (${((Date.now() - started) / 1000).toFixed(1)} s)`)
  }

  for (const c of found) {
    console.log(`\n=== ${c.title} — ${c.toMove === 'red' ? 'Đỏ' : 'Đen'} đi, chiếu bí ${c.moves} nước, nước đầu ${c.keyIsCheck ? 'chiếu' : 'im lặng'}`)
    console.log(asciiBoard(c.pieces, c.toMove === 'black'))
    console.log(`    lời giải: ${c.solution}`)
    console.log(c.dataLine)
  }
  if (found.length < want) console.error(`only ${found.length} found in ${tries} tries — try another --seed or more --max-tries`)
  if (args.out) {
    fs.writeFileSync(path.resolve(args.out), JSON.stringify(found, null, 2))
    console.error(`candidates written to ${args.out}`)
  }
}

const args = parseArgs(process.argv.slice(2))
const command = args._[0]
if (command === 'check') check()
else if (command === 'find') find(args)
else {
  console.log('usage: node scripts/puzzles/puzzle-tool.mjs check | find --moves N [--count K] [--seed S] [--black] [--loose] [--out file]')
  process.exitCode = command ? 1 : 0
}
