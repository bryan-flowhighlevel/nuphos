import { Popover } from '@base-ui/react/popover'
import clsx from 'clsx'
import { useState } from 'react'

import { useBadgeReading, useBadgeStat } from '../../hooks/useBadgeStat'
import { useCharacterPick } from '../../hooks/useProfileCharacter'
import { hairstyleLabel } from '../../lib/profileCharacter'
import { ProfileCharacterPicker } from '../ProfileCharacterPicker'
import { Tooltip } from '../ui/tooltip'

import { BadgeStatPicker } from './BadgeStatPicker'
import { CharacterRing } from './CharacterRing'

import type { AgentConversation } from '../../api'
import type { ProfileCharacter, UserInfo } from '../../types'
import type { ReactNode } from 'react'

/**
 * The person's character at the top of the sidebar, inside a thin ring, with a badge for
 * the one stat they picked. The same character shows in every workspace; the stat reads
 * this workspace's sessions. Clicking the character opens the picker; clicking a badge
 * that counts sessions opens the first of them.
 */
export function SidebarCharacter({
  user,
  fallback,
  teamId,
  sessions = [],
  onOpenSession,
  onUserUpdated,
}: {
  user: UserInfo
  /** What the ring holds before a pick: the workspace tile it replaces. */
  fallback: ReactNode
  teamId?: string
  /** This workspace's sessions, as the sidebar lists them. */
  sessions?: readonly AgentConversation[]
  onOpenSession?: (sessionId: string) => void
  onUserUpdated: (user: UserInfo) => void
}) {
  const { chosen, note, pick } = useCharacterPick(user, onUserUpdated)
  const { stat, pick: pickStat, failed } = useBadgeStat(user, onUserUpdated)
  const reading = useBadgeReading(stat, teamId, sessions)
  const [preview, setPreview] = useState<ProfileCharacter | null>(null)
  const [open, setOpen] = useState(false)
  // Hover and keyboard focus each play the loop once.
  const [plays, setPlays] = useState(0)
  const character = preview ?? chosen
  const statPart = reading.badge ? `. ${reading.summary}` : ''
  const label = chosen ? `Your character${statPart}. Change character` : 'Pick your character'
  const target = reading.badge && reading.sessionId ? reading.sessionId : undefined

  function choose(next: ProfileCharacter) {
    setPreview(null)
    if (next !== chosen || note?.kind === 'failed') void pick(next)
  }

  let hint = ''

  if (!chosen) hint = 'Pick Boy or Girl, then a hairstyle.'
  else if (preview && preview !== chosen) hint = `Previewing ${hairstyleLabel(preview)}`
  else if (note && note.kind !== 'failed') hint = note.text

  const badgeClass =
    'absolute -bottom-0.5 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-zViolet-500 px-[3px] text-[9px] font-bold tabular-nums leading-none text-white'

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setPreview(null)
      }}
    >
      <span className="relative flex-none">
        <Tooltip
          content={chosen ? reading.summary : 'Pick your character'}
          side="bottom"
          disabled={open}
        >
          <Popover.Trigger
            aria-label={label}
            onPointerEnter={() => setPlays((count) => count + 1)}
            onFocus={(event) => {
              if (event.currentTarget.matches(':focus-visible')) setPlays((count) => count + 1)
            }}
            className="titlebar-no-drag relative block flex-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-zViolet-accent/60"
          >
            <CharacterRing
              size={26}
              stroke={2}
              character={character}
              fallback={fallback}
              fraction={reading.fraction}
              plays={plays}
            />
            {!chosen && (
              <span
                aria-hidden
                className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-zViolet-accent ring-2 ring-[rgb(var(--color-background-base))]"
              />
            )}
          </Popover.Trigger>
        </Tooltip>
        {chosen && reading.badge && target && onOpenSession ? (
          <button
            type="button"
            aria-label={`${reading.summary}. Open the first one`}
            title={reading.summary}
            onClick={() => onOpenSession(target)}
            className={clsx(
              badgeClass,
              'titlebar-no-drag outline-none hover:bg-zViolet-600 focus-visible:ring-2 focus-visible:ring-zViolet-accent/60',
            )}
          >
            {reading.badge}
          </button>
        ) : (
          chosen &&
          reading.badge && (
            <span aria-hidden className={clsx(badgeClass, 'pointer-events-none')}>
              {reading.badge}
            </span>
          )
        )}
      </span>
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
            <div className="flex items-center gap-3.5">
              <span className="relative flex-none">
                <CharacterRing
                  size={64}
                  stroke={4}
                  character={character}
                  fallback={fallback}
                  fraction={reading.fraction}
                  looping
                />
                {reading.badge && (
                  <span className="absolute bottom-[-5px] left-1/2 flex h-5 min-w-6 -translate-x-1/2 items-center justify-center rounded-full bg-zViolet-500 px-1.5 text-[11px] font-bold tabular-nums leading-none text-white">
                    {reading.badge}
                  </span>
                )}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold text-main">
                  {user.name || user.username}
                </div>
                <div className="text-[12px] text-secondary">{reading.summary}</div>
              </div>
            </div>
            <div className="mb-2.5 mt-2 min-h-[18px] text-[12px]">
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
            <BadgeStatPicker value={stat} failed={failed} onPick={(next) => void pickStat(next)} />
            <ProfileCharacterPicker value={chosen} onPick={choose} onPreview={setPreview} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
