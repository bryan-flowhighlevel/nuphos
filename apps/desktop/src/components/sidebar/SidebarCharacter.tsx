import { Popover } from '@base-ui/react/popover'
import clsx from 'clsx'
import { useId, useState } from 'react'

import { useCharacterPick, useProfileLevel } from '../../hooks/useProfileCharacter'
import { daysToNextLevel, hairstyleLabel, levelProgress, levelTitle } from '../../lib/profileLevel'
import { ProfileCharacterImage } from '../ProfileCharacterImage'
import { ProfileCharacterPicker } from '../ProfileCharacterPicker'
import { Tooltip } from '../ui/tooltip'

import './CharacterRing.css'

import type { ProfileCharacter, ProfileLevel, UserInfo } from '../../types'
import type { ReactNode } from 'react'

/** The character inside a ring that fills with XP. Before a pick, `fallback` sits in the ring. */
function CharacterRing({
  size,
  stroke,
  character,
  fallback,
  level,
  animated,
  badge,
}: {
  size: number
  stroke: number
  character: ProfileCharacter | undefined
  fallback: ReactNode
  level: ProfileLevel | null
  animated: boolean
  badge: 'small' | 'large'
}) {
  const gradientId = useId()
  const radius = size / 2 - stroke / 2
  const length = 2 * Math.PI * radius
  const progress = level ? levelProgress(level) : 0
  const inset = stroke + Math.round(size * 0.06)

  return (
    <span className="relative block flex-none" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${String(size)} ${String(size)}`}
        className="absolute inset-0 -rotate-90"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="rgb(var(--color-zViolet-500))" />
            <stop offset="1" stopColor="rgb(var(--color-zViolet-accent))" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-zGray-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={`url(#${gradientId})`}
          strokeDasharray={length}
          strokeDashoffset={length * (1 - progress)}
          className="character-ring-fill"
          opacity={progress > 0 ? 1 : 0}
        />
      </svg>
      <span
        className="absolute flex items-center justify-center overflow-hidden rounded-full"
        style={{ inset }}
      >
        {character ? (
          <ProfileCharacterImage
            character={character}
            animated={animated}
            className="character-ring-character h-full w-full"
          />
        ) : (
          fallback
        )}
      </span>
      {level && (
        <span
          className={clsx(
            'character-ring-badge absolute flex items-center justify-center rounded-full bg-zViolet-500 font-bold tabular-nums leading-none text-white',
            badge === 'small'
              ? '-bottom-0.5 -right-1 h-3.5 min-w-3.5 px-[3px] text-[9px]'
              : 'bottom-[-5px] left-1/2 h-5 min-w-6 -translate-x-1/2 px-1.5 text-[11px]',
          )}
        >
          {level.level}
        </span>
      )}
    </span>
  )
}

function LevelLine({ level, status }: { level: ProfileLevel | null; status: unknown }) {
  if (!level)
    return (
      <span className="text-tertiary">
        {status === 'loading' ? 'Counting your days…' : 'Level unavailable'}
      </span>
    )
  const daysLeft = daysToNextLevel(level)

  return (
    <>
      <span className="font-semibold text-main">
        {level.levelXp.toLocaleString()} / {level.levelSize.toLocaleString()} XP
      </span>
      <span>
        {daysLeft} more {daysLeft === 1 ? 'day' : 'days'} to Level {level.level + 1}
      </span>
    </>
  )
}

/**
 * The person's character at the top of the sidebar, inside a thin ring that fills with XP
 * and their level on it. The same character shows in every workspace: XP belongs to the
 * person. Clicking it opens the Boy/Girl then hairstyle picker; the ring previews live.
 */
export function SidebarCharacter({
  user,
  fallback,
  onUserUpdated,
}: {
  user: UserInfo
  /** What the ring holds before a pick: the workspace tile it replaces. */
  fallback: ReactNode
  onUserUpdated: (user: UserInfo) => void
}) {
  const { level, status, levelledUp } = useProfileLevel(user.id)
  const { chosen, note, pick } = useCharacterPick(user, onUserUpdated)
  const [preview, setPreview] = useState<ProfileCharacter | null>(null)
  const [open, setOpen] = useState(false)
  const character = preview ?? chosen
  const levelPart = level ? `, level ${String(level.level)}` : ''
  const label = chosen ? `Your character${levelPart}. Change character` : 'Pick your character'

  function choose(next: ProfileCharacter) {
    setPreview(null)
    if (next !== chosen || note?.kind === 'failed') void pick(next)
  }

  let hint = ''

  if (!chosen) hint = 'Pick Boy or Girl, then a hairstyle.'
  else if (preview && preview !== chosen) hint = `Previewing ${hairstyleLabel(preview)}`
  else if (note && note.kind !== 'failed') hint = note.text

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setPreview(null)
      }}
    >
      <Tooltip
        content={chosen ? 'Your character' : 'Pick your character'}
        side="bottom"
        disabled={open}
      >
        <Popover.Trigger
          aria-label={label}
          className={clsx(
            'titlebar-no-drag relative flex-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-zViolet-accent/60',
            levelledUp && 'character-level-up',
          )}
        >
          <CharacterRing
            size={26}
            stroke={2}
            character={character}
            fallback={fallback}
            level={level}
            animated
            badge="small"
          />
          {!chosen && (
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-zViolet-accent ring-2 ring-[rgb(var(--color-background-base))]"
            />
          )}
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={8} className="z-[1000]">
          <Popover.Popup
            aria-label="Your character"
            className={(state) =>
              clsx(
                't-dropdown w-[340px] rounded-xl border border-zGray-800/60 bg-main p-3.5 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] outline-none',
                state.open && 'is-open',
                state.transitionStatus === 'ending' && 'is-closing',
              )
            }
            style={{ transformOrigin: 'top left' }}
          >
            <div className={clsx('flex items-center gap-3.5', levelledUp && 'character-level-up')}>
              <CharacterRing
                size={64}
                stroke={4}
                character={character}
                fallback={fallback}
                level={level}
                animated
                badge="large"
              />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-zViolet-accent">
                  {level ? `Level ${String(level.level)} · ${levelTitle(level.level)}` : ' '}
                </div>
                <div className="truncate text-[14px] font-semibold text-main">
                  {user.name || user.username}
                </div>
                <div className="flex flex-wrap gap-x-2.5 text-[12px] text-secondary tabular-nums">
                  <LevelLine level={level} status={status} />
                </div>
              </div>
            </div>
            <div className="mb-3 mt-2 min-h-[18px] text-[12px]">
              {note?.kind === 'failed' && !preview ? (
                <div role="alert" className="flex items-center gap-2 text-red-400">
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
                <div aria-live="polite" className="text-tertiary">
                  {hint}
                </div>
              )}
            </div>
            <ProfileCharacterPicker value={chosen} onPick={choose} onPreview={setPreview} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
