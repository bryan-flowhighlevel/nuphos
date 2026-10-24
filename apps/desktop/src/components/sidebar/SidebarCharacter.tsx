import { useState } from 'react'

import { useBadgeReading, useBadgeStat } from '../../hooks/useBadgeStat'
import { useCharacterPick } from '../../hooks/useProfileCharacter'

import { CharacterRing } from './CharacterRing'

import type { AgentConversation } from '../../api'
import type { UserInfo } from '../../types'
import type { ReactNode } from 'react'

/**
 * The person's character in the workspace row, in a thin ring with a badge for the one
 * stat they picked. It only displays: clicking it opens the workspace menu like the tile it
 * replaces, and the character is changed in Team settings › General. Hovering plays the
 * idle loop once. Before a pick, the workspace tile shows as before.
 */
export function SidebarCharacter({
  user,
  fallback,
  teamId,
  sessions = [],
  onUserUpdated,
}: {
  user: UserInfo
  /** The workspace tile, shown until the person picks a character. */
  fallback: ReactNode
  teamId?: string
  /** This workspace's sessions, as the sidebar lists them. */
  sessions?: readonly AgentConversation[]
  onUserUpdated: (user: UserInfo) => void
}) {
  // Both hooks also send up a pick kept on this computer once the server can take it.
  const { chosen } = useCharacterPick(user, onUserUpdated)
  const { stat } = useBadgeStat(user, onUserUpdated)
  const reading = useBadgeReading(stat, teamId, sessions)
  const [plays, setPlays] = useState(0)

  if (!chosen) return <>{fallback}</>

  return (
    <span
      className="relative flex-none"
      title={reading.summary}
      onPointerEnter={() => setPlays((count) => count + 1)}
    >
      <CharacterRing
        size={26}
        stroke={2}
        character={chosen}
        fallback={fallback}
        fraction={reading.fraction}
        plays={plays}
      />
      {reading.badge && (
        <span
          aria-hidden
          className="absolute -bottom-0.5 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-zViolet-500 px-[3px] text-[9px] font-bold tabular-nums leading-none text-white"
        >
          {reading.badge}
        </span>
      )}
    </span>
  )
}
