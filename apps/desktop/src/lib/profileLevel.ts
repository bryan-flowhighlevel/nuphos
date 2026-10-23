import type { ProfileCharacter, ProfileLevel } from '../types/team.ts'

export const PROFILE_CHARACTERS: readonly ProfileCharacter[] = ['boy', 'girl']

/** Swap the art by replacing these files; each marks one bot-body and two bot-eye groups. */
export function profileCharacterSrc(character: ProfileCharacter): string {
  return `/profile-characters/${character}.svg`
}

export function profileCharacterLabel(character: ProfileCharacter): string {
  return character === 'boy' ? 'Boy' : 'Girl'
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
