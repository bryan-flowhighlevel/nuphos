import type { ProfileCharacter, ProfileLevel } from '../types/team.ts'

export type ProfileLook = 'boy' | 'girl'

export const PROFILE_LOOKS: readonly ProfileLook[] = ['boy', 'girl']

/** Three hairstyles per look, in slot order: switching look keeps the slot. */
export const PROFILE_HAIRSTYLES: Record<ProfileLook, readonly ProfileCharacter[]> = {
  boy: ['boy-fringe', 'boy-side', 'boy-curly'],
  girl: ['girl-waves', 'girl-bangs', 'girl-pony'],
}

export const PROFILE_CHARACTERS: readonly ProfileCharacter[] = PROFILE_LOOKS.flatMap(
  (look) => PROFILE_HAIRSTYLES[look],
)

const HAIRSTYLE_LABELS: Record<ProfileCharacter, string> = {
  'boy-fringe': 'Fringe',
  'boy-side': 'Side part',
  'boy-curly': 'Curly',
  'girl-waves': 'Waves',
  'girl-bangs': 'Bangs',
  'girl-pony': 'Ponytail',
}

/** Swap the art by replacing these files; each marks one bot-body and two bot-eye groups. */
export function profileCharacterSrc(character: ProfileCharacter): string {
  return `/profile-characters/${character}.svg`
}

export function profileLook(character: ProfileCharacter): ProfileLook {
  return character.startsWith('girl-') ? 'girl' : 'boy'
}

export function profileLookLabel(look: ProfileLook): string {
  return look === 'boy' ? 'Boy' : 'Girl'
}

export function hairstyleLabel(character: ProfileCharacter): string {
  return HAIRSTYLE_LABELS[character]
}

/** "Girl, ponytail". */
export function profileCharacterLabel(character: ProfileCharacter): string {
  return `${profileLookLabel(profileLook(character))}, ${hairstyleLabel(character).toLowerCase()}`
}

/** The same hairstyle slot in the other look, or the first one when nothing is picked yet. */
export function characterForLook(look: ProfileLook, current?: ProfileCharacter): ProfileCharacter {
  const slot = current ? PROFILE_HAIRSTYLES[profileLook(current)].indexOf(current) : 0

  return PROFILE_HAIRSTYLES[look][Math.max(slot, 0)]
}

const TITLES = ['Newcomer', 'Explorer', 'Builder', 'Operator', 'Navigator'] as const

/** A name for every two levels, then Captain from level 11. */
export function levelTitle(level: number): string {
  return TITLES[Math.floor((Math.max(level, 1) - 1) / 2)] ?? 'Captain'
}

/** Whole days of use left before the next level; one day is 100 XP. */
export function daysToNextLevel({ levelXp, levelSize }: ProfileLevel): number {
  return Math.max(1, Math.ceil((levelSize - levelXp) / 100))
}

/** How far around the ring the current level has filled, 0 to 1. */
export function levelProgress({ levelXp, levelSize }: ProfileLevel): number {
  return levelSize > 0 ? Math.min(1, Math.max(0, levelXp / levelSize)) : 0
}

export function seenLevelKey(userId: string): string {
  return `nuphos.profileLevel.seen.${userId}`
}

/** Celebrate only a level reached since this computer last showed one; the first view just records it. */
export function reachedNewLevel(seen: string | null, level: number): boolean {
  const before = Number(seen)

  return seen !== null && Number.isInteger(before) && level > before
}
