import assert from 'node:assert/strict'
import test from 'node:test'

import { readSlashUsage, recordSlashUse, slashCommandsIn } from './slashUsage.ts'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))

  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  } as unknown as Storage
}

test('each sent command counts once per message', () => {
  const store = memoryStorage()

  recordSlashUse(['review', 'review', 'deploy'], store)
  assert.deepEqual(recordSlashUse(['review'], store), { review: 2, deploy: 1 })
  assert.deepEqual(readSlashUsage(store), { review: 2, deploy: 1 })
})

test('unreadable or odd stored usage reads as none', () => {
  assert.deepEqual(readSlashUsage(null), {})
  assert.deepEqual(readSlashUsage(memoryStorage({ 'nuphos.slashCommandUsage.v1': 'nope' })), {})
  assert.deepEqual(
    readSlashUsage(memoryStorage({ 'nuphos.slashCommandUsage.v1': '{"a":1,"b":"x"}' })),
    { a: 1 },
  )
})

test('a sent message uses the known commands written as /name', () => {
  const known = new Set(['review', 'deploy'])

  assert.deepEqual(slashCommandsIn('/review then /deploy', known), ['review', 'deploy'])
  assert.deepEqual(slashCommandsIn('see a/review and /usr/bin and /other', known), [])
})
