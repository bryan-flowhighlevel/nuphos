import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  PROFILE_CHARACTERS,
  daysToNextLevel,
  levelProgress,
  levelTitle,
  profileCharacterSrc,
  reachedNewLevel,
} from './profileLevel.ts'

const level = (levelXp: number, levelSize: number) => ({
  activeDays: 0,
  xp: 0,
  level: 7,
  levelXp,
  levelSize,
})

test('every character ships one body and two eyes so the shared idle loop moves it', () => {
  for (const character of PROFILE_CHARACTERS) {
    const svg = readFileSync(
      new URL(`../../public${profileCharacterSrc(character)}`, import.meta.url),
      'utf8',
    )

    assert.equal(svg.match(/<g class="bot-body">/g)?.length, 1, character)
    assert.equal(svg.match(/<g class="bot-eye">/g)?.length, 2, character)
    assert.doesNotMatch(svg, /<style/, `${character} stays still until the app animates it`)
  }
})

test('titles change every two levels and settle on Captain', () => {
  assert.deepEqual([1, 2, 3, 5, 7, 9, 10, 11, 40].map(levelTitle), [
    'Newcomer',
    'Newcomer',
    'Explorer',
    'Builder',
    'Operator',
    'Navigator',
    'Navigator',
    'Captain',
    'Captain',
  ])
})

test('the ring and the days left follow the XP inside the current level', () => {
  assert.equal(levelProgress(level(300, 800)), 0.375)
  assert.equal(levelProgress(level(0, 0)), 0)
  assert.equal(daysToNextLevel(level(300, 800)), 5)
  assert.equal(daysToNextLevel(level(750, 800)), 1)
})

test('a level-up plays once, and never on the first view or a stale value', () => {
  assert.equal(reachedNewLevel(null, 7), false)
  assert.equal(reachedNewLevel('6', 7), true)
  assert.equal(reachedNewLevel('7', 7), false)
  assert.equal(reachedNewLevel('8', 7), false)
  assert.equal(reachedNewLevel('junk', 7), false)
})
