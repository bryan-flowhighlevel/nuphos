import { ObjectId } from 'mongodb'
import { z } from 'zod'

import { agentMessages } from '@/lib/agent/db/shared'
import { AppError } from '@/lib/errors'

import { users, mapUser } from './shared'

import type { ProfileCharacter } from './types'

export const PROFILE_CHARACTERS = [
  'boy-fringe',
  'boy-side',
  'boy-curly',
  'girl-waves',
  'girl-bangs',
  'girl-pony',
] as const satisfies readonly ProfileCharacter[]

const characterSchema = z.object({ character: z.enum(PROFILE_CHARACTERS).nullable() }).strict()

/** Picks the person's character (look and hairstyle), or clears it with null. */
export async function setProfileCharacter(userId: string, input: unknown) {
  const parsed = characterSchema.safeParse(input)

  if (!parsed.success)
    throw new AppError(400, 'invalid_character', 'Pick one of the six characters')
  const { character } = parsed.data
  const user = await users().findOneAndUpdate(
    { _id: new ObjectId(userId), deletedAt: { $exists: false } },
    character
      ? { $set: { character, updatedAt: new Date() } }
      : { $unset: { character: '' }, $set: { updatedAt: new Date() } },
    { returnDocument: 'after' },
  )

  if (!user) throw new AppError(404, 'user_not_found', 'Your account no longer exists')

  return mapUser(user)
}

/** XP for each day the person sent at least one message. */
export const XP_PER_DAY = 100

/** Total XP that reaches `level`. Each level costs one more day than the one before. */
export function xpToReach(level: number): number {
  return XP_PER_DAY * ((level * (level + 1)) / 2 - 1)
}

export type ProfileLevel = {
  activeDays: number
  xp: number
  level: number
  /** XP earned inside the current level. */
  levelXp: number
  /** XP the current level takes from start to the next one. */
  levelSize: number
}

export function levelForActiveDays(activeDays: number): ProfileLevel {
  const days = Math.max(0, Math.floor(activeDays))
  const xp = days * XP_PER_DAY
  let level = 1

  while (xpToReach(level + 1) <= xp) level += 1

  return {
    activeDays: days,
    xp,
    level,
    levelXp: xp - xpToReach(level),
    levelSize: xpToReach(level + 1) - xpToReach(level),
  }
}

function validTimeZone(timeZone: string | undefined): string {
  if (!timeZone) return 'UTC'
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })

    return timeZone
  } catch {
    return 'UTC'
  }
}

/**
 * Distinct days, in the person's time zone, on which they sent a message
 * themselves. An agent token acting for them does not count, and neither does
 * a turn they did not write. Messages stored before attribution carry no
 * sender, so for those the conversation owner is the author.
 */
export function activeDaysPipeline(userId: string, timeZone?: string) {
  return [
    {
      $match: {
        role: 'user',
        $or: [
          {
            'metadata.sender.type': 'user',
            'metadata.sender.id': userId,
            'metadata.sender.onBehalfOf': { $exists: false },
          },
          { userId, metadata: { $exists: false } },
        ],
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            date: '$createdAt',
            format: '%Y-%m-%d',
            timezone: validTimeZone(timeZone),
          },
        },
      },
    },
    { $count: 'days' },
  ]
}

export async function readProfileLevel(userId: string, timeZone?: string): Promise<ProfileLevel> {
  const [row] = await agentMessages()
    .aggregate<{ days: number }>(activeDaysPipeline(userId, timeZone))
    .toArray()

  return levelForActiveDays(row?.days ?? 0)
}
