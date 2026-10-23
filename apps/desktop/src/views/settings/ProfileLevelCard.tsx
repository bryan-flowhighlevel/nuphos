import clsx from 'clsx'
import { useEffect, useId, useState } from 'react'

import { api } from '../../api'
import { Avatar } from '../../components/Avatar'
import { ProfileCharacterImage } from '../../components/ProfileCharacterImage'
import { toast } from '../../components/ui/toast'
import {
  PROFILE_CHARACTERS,
  daysToNextLevel,
  levelProgress,
  levelTitle,
  profileCharacterLabel,
  reachedNewLevel,
  seenLevelKey,
} from '../../lib/profileLevel'

import './ProfileLevelCard.css'

import type { ProfileCharacter, ProfileLevel, UserInfo } from '../../types'

const RING_RADIUS = 52
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

function useProfileLevel(userId: string) {
  const [level, setLevel] = useState<ProfileLevel | null>(null)
  const [levelledUp, setLevelledUp] = useState(false)

  useEffect(() => {
    let current = true

    api
      .authReadLevel(Intl.DateTimeFormat().resolvedOptions().timeZone)
      .then((next) => {
        if (!current) return
        const key = seenLevelKey(userId)

        setLevelledUp(reachedNewLevel(localStorage.getItem(key), next.level))
        localStorage.setItem(key, String(next.level))
        setLevel(next)
      })
      .catch((err: unknown) => {
        if (current) toast.apiError('Could not load your level', err)
      })

    return () => {
      current = false
    }
  }, [userId])

  return { level, levelledUp }
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
  const { level, levelledUp } = useProfileLevel(user.id)
  const [saving, setSaving] = useState<ProfileCharacter | null>(null)
  const gradientId = useId()
  const character = saving ?? user.character
  const progress = level ? levelProgress(level) : 0
  const daysLeft = level ? daysToNextLevel(level) : 0

  async function pick(next: ProfileCharacter) {
    if (next === user.character || saving) return
    setSaving(next)
    try {
      onUserUpdated(await api.authSetCharacter(next))
    } catch (err) {
      toast.apiError('Could not change your character', err)
    } finally {
      setSaving(null)
    }
  }

  return (
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
            <span className="text-tertiary">Counting your days…</span>
          )}
        </div>
        <div
          role="radiogroup"
          aria-label="Character"
          className="mt-3 inline-flex rounded-lg border border-zGray-800 bg-surface p-0.5"
        >
          {PROFILE_CHARACTERS.map((option) => {
            const selected = option === character

            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={saving !== null}
                onClick={() => void pick(option)}
                className={clsx(
                  'flex items-center gap-1.5 rounded-md px-3 py-1 text-[12.5px] transition-colors',
                  selected
                    ? 'bg-zViolet-accent/10 font-medium text-zViolet-accent'
                    : 'text-secondary hover:text-main',
                )}
              >
                <ProfileCharacterImage character={option} className="h-5 w-5" />
                {profileCharacterLabel(option)}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
