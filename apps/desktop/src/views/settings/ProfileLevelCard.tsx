import clsx from 'clsx'
import { useEffect, useId, useRef, useState } from 'react'

import { api } from '../../api'
import { Avatar } from '../../components/Avatar'
import { ProfileCharacterImage } from '../../components/ProfileCharacterImage'
import { notifyPendingPick, usePendingPick } from '../../hooks/usePendingPick'
import {
  pendingPick,
  pendingPickKey,
  savePick,
  shownCharacter,
} from '../../lib/profileCharacterSync'
import {
  daysToNextLevel,
  hairstyleLabel,
  levelProgress,
  levelTitle,
  profileCharacterLabel,
  reachedNewLevel,
  seenLevelKey,
} from '../../lib/profileLevel'

import { ProfileCharacterPicker } from './ProfileCharacterPicker'

import './ProfileLevelCard.css'

import type { ProfileCharacter, ProfileLevel, UserInfo } from '../../types'

const RING_RADIUS = 52
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

/** The level, or `unavailable` when the server cannot give one; the character works either way. */
function useProfileLevel(userId: string) {
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

type PickNote =
  { kind: 'saved' | 'kept-here'; text: string } | { kind: 'failed'; character: ProfileCharacter }

/**
 * Picks show at once and are kept on this computer until the server takes them. A
 * server without the character route keeps the pick here and syncs it on a later
 * visit; any other failure says so with a Retry.
 */
function useCharacterPick(user: UserInfo, onUserUpdated: (user: UserInfo) => void) {
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

/** The person's character inside a ring that fills with XP, their level on the ring. */
export function ProfileLevelCard({
  user,
  displayName,
  onUserUpdated,
}: {
  user: UserInfo
  displayName: string
  onUserUpdated: (user: UserInfo) => void
}) {
  const { level, status, levelledUp } = useProfileLevel(user.id)
  const { chosen, note, pick } = useCharacterPick(user, onUserUpdated)
  const [preview, setPreview] = useState<ProfileCharacter | null>(null)
  const gradientId = useId()
  const character = preview ?? chosen
  const progress = level ? levelProgress(level) : 0
  const daysLeft = level ? daysToNextLevel(level) : 0

  function choose(next: ProfileCharacter) {
    setPreview(null)
    if (next !== chosen || note?.kind === 'failed') void pick(next)
  }

  let hint = ''

  if (!chosen) hint = 'Pick a character below.'
  else if (preview && preview !== chosen) hint = `Previewing ${hairstyleLabel(preview)}`
  else if (note && note.kind !== 'failed') hint = note.text

  return (
    <div>
      <div className={clsx('flex items-center gap-5', levelledUp && 'profile-level-up')}>
        <div className="relative h-28 w-28 flex-none">
          <svg viewBox="0 0 112 112" className="absolute inset-0 -rotate-90" aria-hidden>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="rgb(var(--color-zViolet-500))" />
                <stop offset="1" stopColor="rgb(var(--color-zViolet-accent))" />
              </linearGradient>
            </defs>
            <circle
              cx="56"
              cy="56"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="6"
              className="stroke-zGray-800"
            />
            <circle
              cx="56"
              cy="56"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              stroke={`url(#${gradientId})`}
              strokeDasharray={RING_LENGTH}
              strokeDashoffset={RING_LENGTH * (1 - progress)}
              className="profile-ring-fill"
              opacity={progress > 0 ? 1 : 0}
            />
          </svg>
          {character ? (
            <ProfileCharacterImage
              character={character}
              animated
              className="profile-ring-character absolute inset-3.5 h-[84px] w-[84px]"
            />
          ) : (
            <Avatar
              src={user.avatarURL}
              name={displayName}
              size={76}
              className="absolute left-[18px] top-[18px] rounded-full !shadow-none"
            />
          )}
          {level && (
            <div
              aria-label={`Level ${String(level.level)}`}
              className="profile-ring-badge absolute bottom-[-6px] left-1/2 flex h-6 min-w-[30px] -translate-x-1/2 items-center justify-center rounded-full border-[3px] border-[rgb(var(--color-background-base))] bg-zViolet-500 px-2 text-[13px] font-bold tabular-nums text-white"
            >
              {level.level}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-zViolet-accent">
            {level ? levelTitle(level.level) : ' '}
          </div>
          <div className="truncate text-[16px] font-semibold text-main">{displayName}</div>
          <div className="mt-0.5 flex flex-wrap gap-x-4 text-[12.5px] text-secondary tabular-nums">
            {level ? (
              <>
                <span>
                  <b className="font-semibold text-main">{level.activeDays}</b>{' '}
                  {level.activeDays === 1 ? 'day' : 'days'} on Nuphos
                </span>
                <span>
                  <b className="font-semibold text-main">
                    {level.levelXp.toLocaleString()} / {level.levelSize.toLocaleString()} XP
                  </b>
                </span>
                <span>
                  {daysLeft} more {daysLeft === 1 ? 'day' : 'days'} to Level {level.level + 1}
                </span>
              </>
            ) : (
              <span className="text-tertiary">
                {status === 'loading' ? 'Counting your days…' : 'Level unavailable'}
              </span>
            )}
          </div>
          {note?.kind === 'failed' && !preview ? (
            <div
              role="alert"
              className="mt-0.5 flex h-[18px] items-center gap-2 text-[12.5px] text-red-400"
            >
              Couldn't save your character.
              <button
                type="button"
                onClick={() => void pick(note.character)}
                className="font-medium text-zViolet-accent underline-offset-2 hover:underline"
              >
                Retry
              </button>
            </div>
          ) : (
            <div aria-live="polite" className="mt-0.5 h-[18px] text-[12.5px] text-tertiary">
              {hint}
            </div>
          )}
        </div>
      </div>
      <ProfileCharacterPicker value={chosen} onPick={choose} onPreview={setPreview} />
    </div>
  )
}
