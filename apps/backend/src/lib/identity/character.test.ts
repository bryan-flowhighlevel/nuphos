import { expect, test } from 'bun:test'
import { ObjectId } from 'mongodb'

import {
  activeDaysPipeline,
  UNATTRIBUTED_BEFORE,
  levelForActiveDays,
  readProfileLevel,
  setProfileCharacter,
  xpToReach,
} from './character'

import { useDb } from '@/lib/test/doubles/db'

const id = new ObjectId()
let update: { filter: unknown; values: unknown } | undefined
let pipeline: unknown
let days: number | undefined = 30

useDb({
  db: () => ({
    collection: (name: string) => ({
      findOneAndUpdate: async (filter: unknown, values: unknown) => {
        update = { filter, values }
        const set = (values as { $set: { character?: string } }).$set

        return {
          _id: id,
          email: 'alice@example.com',
          name: 'Alice',
          username: 'alice',
          avatarURL: '',
          language: 'en',
          createdAt: new Date(),
          ...(set.character ? { character: set.character } : {}),
        }
      },
      aggregate: (stages: unknown) => {
        if (name === 'agent_messages') pipeline = stages

        return { toArray: async () => (days === undefined ? [] : [{ days }]) }
      },
    }),
  }),
})

test('each level takes one more day than the one before', () => {
  expect([1, 2, 3, 5, 10].map(xpToReach)).toEqual([0, 200, 500, 1400, 5400])
  expect(levelForActiveDays(0)).toEqual({
    activeDays: 0,
    xp: 0,
    level: 1,
    levelXp: 0,
    levelSize: 200,
  })
  expect(levelForActiveDays(1).level).toBe(1)
  expect(levelForActiveDays(2).level).toBe(2)
  expect(levelForActiveDays(14).level).toBe(5)
  expect(levelForActiveDays(54).level).toBe(10)
  expect(levelForActiveDays(30)).toEqual({
    activeDays: 30,
    xp: 3000,
    level: 7,
    levelXp: 300,
    levelSize: 800,
  })
})

test('the level counts distinct days the person sent a message themselves', async () => {
  days = 30
  expect((await readProfileLevel('u1', 'America/Los_Angeles')).level).toBe(7)
  expect(pipeline).toEqual(activeDaysPipeline('u1', 'America/Los_Angeles'))
  const [match, project, group] = pipeline as [
    { $match: { $or: Record<string, unknown>[] } },
    { $project: Record<string, number> },
    { $group: { _id: { $dateToString: { timezone: string } } } },
  ]

  // Agent tokens acting for them are not them; unattributed history belongs to the owner.
  expect(match.$match.$or).toEqual([
    {
      'metadata.sender.type': 'user',
      'metadata.sender.id': 'u1',
      'metadata.sender.onBehalfOf': { $exists: false },
      role: 'user',
    },
    {
      userId: 'u1',
      role: 'user',
      createdAt: { $lt: UNATTRIBUTED_BEFORE },
      metadata: { $exists: false },
    },
  ])
  // Only the timestamp travels to the grouping, never the message parts.
  expect(project.$project).toEqual({ _id: 0, createdAt: 1 })
  expect(group.$group._id.$dateToString.timezone).toBe('America/Los_Angeles')
})

test('an unknown time zone falls back to UTC and no messages is level 1', async () => {
  days = undefined
  expect(await readProfileLevel('u1', 'Mars/Olympus')).toMatchObject({ activeDays: 0, level: 1 })
  const [, , group] = pipeline as [
    unknown,
    unknown,
    { $group: { _id: { $dateToString: { timezone: string } } } },
  ]

  expect(group.$group._id.$dateToString.timezone).toBe('UTC')
})

test('a person picks one of the six characters, can clear it, and nothing else is accepted', async () => {
  const picked = await setProfileCharacter(id.toHexString(), { character: 'girl-pony' })

  expect(picked.character).toBe('girl-pony')
  expect(update?.filter).toEqual({ _id: id, deletedAt: { $exists: false } })
  expect(update?.values).toEqual({ $set: { character: 'girl-pony', updatedAt: expect.any(Date) } })

  const cleared = await setProfileCharacter(id.toHexString(), { character: null })

  expect(cleared.character).toBeUndefined()
  expect(update?.values).toEqual({
    $unset: { character: '' },
    $set: { updatedAt: expect.any(Date) },
  })

  for (const input of [
    { character: 'dragon' },
    { character: 'boy' },
    { character: 'boy-fringe', name: 'x' },
    null,
    {},
  ]) {
    await expect(setProfileCharacter(id.toHexString(), input)).rejects.toMatchObject({
      status: 400,
      code: 'invalid_character',
    })
  }
})
