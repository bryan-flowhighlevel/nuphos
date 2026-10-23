import { useSyncExternalStore } from 'react'

import { pendingPick, pendingPickKey } from '../lib/profileCharacterSync'

import type { ProfileCharacter } from '../types'

const listeners = new Set<() => void>()

/** Tells every view showing the person's character that this computer's pick changed. */
export function notifyPendingPick(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key?.startsWith(pendingPickKey(''))) listener()
  }

  listeners.add(listener)
  window.addEventListener('storage', onStorage)

  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** A pick this computer still has to save for `userId`, kept in step across views and windows. */
export function usePendingPick(userId: string): ProfileCharacter | undefined {
  return useSyncExternalStore(subscribe, () => pendingPick(localStorage, userId))
}
