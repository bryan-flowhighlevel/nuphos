import assert from 'node:assert/strict'
import test from 'node:test'

import { pendingPick, savePick, shownCharacter } from './profileCharacterSync.ts'

import type { PickStorage } from './profileCharacterSync.ts'
import type { ProfileCharacter, SetCharacterResult, UserInfo } from '../types/team.ts'

const user: UserInfo = { id: 'u1', name: 'Alex', email: 'a@example.com', username: 'alex' }

function memory(): PickStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()

  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}

const answer = (result: SetCharacterResult | Error) => async (_c: ProfileCharacter) => {
  if (result instanceof Error) throw result

  return result
}

test('a saved pick comes back as the user and leaves nothing pending', async () => {
  const storage = memory()
  const saved = { ...user, character: 'girl-pony' as const }
  const outcome = await savePick('girl-pony', 'u1', { storage, send: answer({ user: saved }) })

  assert.deepEqual(outcome, { kind: 'saved', user: saved })
  assert.equal(pendingPick(storage, 'u1'), undefined)
})

test('a server without the route (404) keeps the pick on this computer, shown in the ring', async () => {
  const storage = memory()
  const outcome = await savePick('boy-curly', 'u1', {
    storage,
    send: answer({ unsupported: true }),
  })

  assert.deepEqual(outcome, { kind: 'kept-here' })
  assert.equal(pendingPick(storage, 'u1'), 'boy-curly')
  assert.equal(shownCharacter(user, pendingPick(storage, 'u1')), 'boy-curly')
})

test('a network error fails out loud and keeps the pick for a retry', async () => {
  const storage = memory()
  const outcome = await savePick('girl-waves', 'u1', {
    storage,
    send: answer(new Error('fetch failed')),
  })

  assert.deepEqual(outcome, { kind: 'failed', message: 'fetch failed' })
  assert.equal(pendingPick(storage, 'u1'), 'girl-waves')
})

test('an unknown stored value is ignored, and picks are kept per person', () => {
  const storage = memory()

  storage.setItem('nuphos.profileCharacter.pending.u1', 'dragon')
  assert.equal(pendingPick(storage, 'u1'), undefined)
  assert.equal(shownCharacter({ ...user, character: 'boy-side' }, undefined), 'boy-side')
  storage.setItem('nuphos.profileCharacter.pending.u2', 'girl-bangs')
  assert.equal(pendingPick(storage, 'u1'), undefined)
})
