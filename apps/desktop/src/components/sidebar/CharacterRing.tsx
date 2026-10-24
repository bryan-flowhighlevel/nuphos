import { useId } from 'react'

import { ProfileCharacterImage } from '../ProfileCharacterImage'

import './CharacterRing.css'

import type { ProfileCharacter } from '../../types'
import type { ReactNode } from 'react'

/**
 * The character inside a thin ring. For a stat with a natural maximum the ring fills to it;
 * for a plain count it is a quiet full ring. Before a pick, `fallback` sits in the ring.
 */
export function CharacterRing({
  size,
  stroke,
  character,
  fallback,
  fraction,
  looping = false,
  plays = 0,
}: {
  size: number
  stroke: number
  character: ProfileCharacter | undefined
  fallback: ReactNode
  /** Ring fill 0 to 1, or null for a quiet full ring that is not progress. */
  fraction: number | null
  /** Repeat the idle loop (the picker, while open). Otherwise each new `plays` plays it once. */
  looping?: boolean
  plays?: number
}) {
  const gradientId = useId()
  const radius = size / 2 - stroke / 2
  const length = 2 * Math.PI * radius
  const quiet = fraction === null
  const progress = quiet ? 0 : Math.min(1, Math.max(0, fraction))
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
          className={quiet ? 'stroke-zViolet-500/35' : 'stroke-zGray-800'}
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
            looping={looping}
            plays={plays}
            className="character-ring-character h-full w-full"
          />
        ) : (
          fallback
        )}
      </span>
    </span>
  )
}
