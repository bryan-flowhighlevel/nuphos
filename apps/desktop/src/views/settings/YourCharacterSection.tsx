import { useState } from 'react'

import { ProfileCharacterPicker } from '../../components/ProfileCharacterPicker'
import { BadgeStatPicker } from '../../components/sidebar/BadgeStatPicker'
import { CharacterRing } from '../../components/sidebar/CharacterRing'
import { agentSessionsCacheKey } from '../../components/sidebar/state'
import { useBadgeReading, useBadgeStat } from '../../hooks/useBadgeStat'
import { useCharacterPick } from '../../hooks/useProfileCharacter'
import { hairstyleLabel } from '../../lib/profileCharacter'
import { readSwrCache } from '../../lib/swrCache'

import type { AgentConversation } from '../../api'
import type { ProfileCharacter, UserInfo } from '../../types'

/**
 * The person's own character and badge stat, edited here and shown in the sidebar's
 * workspace row. Personal, not per workspace, so any member can change theirs.
 */
export function YourCharacterSection({
  user,
  teamId,
  onUserUpdated,
}: {
  user: UserInfo
  teamId: string
  onUserUpdated: (user: UserInfo) => void
}) {
  const { chosen, note, pick } = useCharacterPick(user, onUserUpdated)
  const { stat, pick: pickStat, failed } = useBadgeStat(user, onUserUpdated)
  // The sessions the sidebar last loaded for this workspace, so the preview counts the same.
  const [sessions] = useState(
    () => readSwrCache<AgentConversation[]>(agentSessionsCacheKey(teamId)) ?? [],
  )
  const reading = useBadgeReading(stat, teamId, sessions)
  const [preview, setPreview] = useState<ProfileCharacter | null>(null)
  const character = preview ?? chosen

  function choose(next: ProfileCharacter) {
    setPreview(null)
    if (next !== chosen || note?.kind === 'failed') void pick(next)
  }

  let hint = 'Pick Boy or Girl, then a hairstyle.'

  if (preview && preview !== chosen) hint = `Previewing ${hairstyleLabel(preview)}`
  else if (note && note.kind !== 'failed') hint = note.text
  else if (chosen) hint = 'Shown at the top of your sidebar, in every workspace.'

  return (
    <section aria-labelledby="your-character" className="mt-10">
      <h2 id="your-character" className="text-[15px] font-semibold text-main">
        Your character
      </h2>
      <p className="mt-1 text-[13px] text-tertiary">
        Only you see this choice. It replaces the workspace icon in your sidebar.
      </p>
      <div className="mt-4 rounded-xl border border-zGray-800 p-4">
        <div className="mb-4 flex items-center gap-3.5">
          <span className="relative flex-none" aria-hidden={!character}>
            <CharacterRing
              size={64}
              stroke={4}
              character={character ?? undefined}
              fallback={<span className="h-full w-full rounded-full bg-zGray-800/60" />}
              fraction={reading.fraction}
              looping
            />
            {character && reading.badge && (
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
            <div aria-live="polite" className="mt-0.5 text-[12px] text-tertiary">
              {note?.kind === 'failed' && !preview ? (
                <span role="alert" className="text-red-400">
                  Couldn't save your character.{' '}
                  <button
                    type="button"
                    onClick={() => void pick(note.character)}
                    className="font-medium text-zViolet-accent underline-offset-2 hover:underline"
                  >
                    Retry
                  </button>
                </span>
              ) : (
                hint
              )}
            </div>
          </div>
        </div>
        <BadgeStatPicker value={stat} failed={failed} onPick={(next) => void pickStat(next)} />
        <ProfileCharacterPicker value={chosen} onPick={choose} onPreview={setPreview} />
      </div>
    </section>
  )
}
