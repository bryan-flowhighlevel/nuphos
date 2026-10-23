import { PROFILE_CHARACTERS } from './profileLevel.ts'

import type { ProfileCharacter, SetCharacterResult, UserInfo } from '../types/team.ts'

/** Where a pick waits on this computer until the server takes it. */
export type PickStorage = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export function pendingPickKey(userId: string): string {
  return `nuphos.profileCharacter.pending.${userId}`
}

/** The pick this computer still has to save, if it is one this build knows. */
export function pendingPick(storage: PickStorage, userId: string): ProfileCharacter | undefined {
  const value = storage.getItem(pendingPickKey(userId))

  return PROFILE_CHARACTERS.find((character) => character === value)
}

/** What the ring shows: a pick still waiting on this computer, else the saved one. */
export function shownCharacter(
  user: UserInfo,
  pending: ProfileCharacter | undefined,
): ProfileCharacter | undefined {
  return pending ?? user.character
}

export type SaveOutcome =
  | { kind: 'saved'; user: UserInfo }
  /** The server has no character route yet; the pick stays on this computer and syncs later. */
  | { kind: 'kept-here' }
  | { kind: 'failed'; message: string }

/**
 * Keeps the pick on this computer first, so it shows at once and survives a failed save,
 * then sends it. Only a save the server accepted clears the local copy.
 */
export async function savePick(
  character: ProfileCharacter,
  userId: string,
  deps: {
    storage: PickStorage
    send: (character: ProfileCharacter) => Promise<SetCharacterResult>
  },
): Promise<SaveOutcome> {
  deps.storage.setItem(pendingPickKey(userId), character)
  try {
    const result = await deps.send(character)

    if ('unsupported' in result) return { kind: 'kept-here' }
    // A newer pick made while this one was in flight stays pending for its own save.
    if (pendingPick(deps.storage, userId) === character)
      deps.storage.removeItem(pendingPickKey(userId))

    return { kind: 'saved', user: result.user }
  } catch (err) {
    return { kind: 'failed', message: err instanceof Error ? err.message : String(err) }
  }
}
