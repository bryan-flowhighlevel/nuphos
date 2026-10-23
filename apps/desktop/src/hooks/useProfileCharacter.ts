import { useEffect, useRef, useState } from 'react'

import { api } from '../api'
import { pendingPick, pendingPickKey, savePick, shownCharacter } from '../lib/profileCharacterSync'
import { profileCharacterLabel, reachedNewLevel, seenLevelKey } from '../lib/profileLevel'

import { notifyPendingPick, usePendingPick } from './usePendingPick'

import type { ProfileCharacter, ProfileLevel, UserInfo } from '../types'

/** The level, or `unavailable` when the server cannot give one; the character works either way. */
export function useProfileLevel(userId: string) {
  const [level, setLevel] = useState<ProfileLevel | 'loading' | 'unavailable'>('loading')
  const [levelledUp, setLevelledUp] = useState(false)

  useEffect(() => {
    let current = true

    api
      .authReadLevel(Intl.DateTimeFormat().resolvedOptions().timeZone)
      .then((next) => {
        if (!current) return
        // A server without the level route yet: the level parts stay hidden.
        if (!next) {
          setLevel('unavailable')

          return
        }
        const key = seenLevelKey(userId)

        setLevelledUp(reachedNewLevel(localStorage.getItem(key), next.level))
        localStorage.setItem(key, String(next.level))
        setLevel(next)
      })
      .catch(() => {
        // Offline or a server error: say so quietly rather than counting forever.
        if (current) setLevel('unavailable')
      })

    return () => {
      current = false
    }
  }, [userId])

  return { level: typeof level === 'object' ? level : null, status: level, levelledUp }
}

export type PickNote =
  { kind: 'saved' | 'kept-here'; text: string } | { kind: 'failed'; character: ProfileCharacter }

/**
 * Picks show at once and are kept on this computer until the server takes them. A
 * server without the character route keeps the pick here and syncs it on a later
 * visit; any other failure says so with a Retry.
 */
export function useCharacterPick(user: UserInfo, onUserUpdated: (user: UserInfo) => void) {
  const pending = usePendingPick(user.id)
  const [note, setNote] = useState<PickNote | null>(null)
  const latest = useRef<ProfileCharacter | null>(null)

  async function pick(next: ProfileCharacter) {
    latest.current = next
    const outcome = savePick(next, user.id, { storage: localStorage, send: api.authSetCharacter })

    notifyPendingPick()
    const result = await outcome

    notifyPendingPick()
    if (latest.current !== next) return
    if (result.kind === 'saved') onUserUpdated(result.user)
    if (result.kind === 'saved')
      setNote({ kind: 'saved', text: `Saved · ${profileCharacterLabel(next)}` })
    else if (result.kind === 'kept-here')
      setNote({ kind: 'kept-here', text: 'Saved on this computer' })
    else setNote({ kind: 'failed', character: next })
  }

  // A pick kept here earlier goes up quietly once the server can take it.
  useEffect(() => {
    const waiting = pendingPick(localStorage, user.id)

    if (!waiting) return
    if (waiting === user.character) {
      localStorage.removeItem(pendingPickKey(user.id))
      notifyPendingPick()

      return
    }
    void savePick(waiting, user.id, { storage: localStorage, send: api.authSetCharacter }).then(
      (result) => {
        notifyPendingPick()
        if (result.kind === 'saved') onUserUpdated(result.user)
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per person, not on every pick
  }, [user.id])

  return { chosen: shownCharacter(user, pending), note, pick }
}
