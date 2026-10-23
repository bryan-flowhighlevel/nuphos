import { useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'

import { animatedSvgUrl, loadAnimatedSvg, withIdleMotion } from '../lib/botAvatarMotion'
import { profileCharacterLabel, profileCharacterSrc } from '../lib/profileLevel'

import type { ProfileCharacter } from '../types'

const animate = (svg: string) => withIdleMotion(svg, 0)

/**
 * The person's profile character. `animated` plays the same idle loop as the
 * Agent avatars; each animated image repaints every frame, so use it where it is seen.
 */
export function ProfileCharacterImage({
  character,
  animated = false,
  className,
}: {
  character: ProfileCharacter
  animated?: boolean
  className?: string
}) {
  const src = profileCharacterSrc(character)
  const reduceMotion = useReducedMotion()
  const live = animated && !reduceMotion
  const [, setLoaded] = useState(0)
  const moving = live ? animatedSvgUrl(src) : undefined

  useEffect(() => {
    if (!live || animatedSvgUrl(src)) return
    let current = true

    void loadAnimatedSvg(src, animate).then((loaded) => {
      if (loaded && current) setLoaded((count) => count + 1)
    })

    return () => {
      current = false
    }
  }, [src, live])

  return (
    <img
      src={moving ?? src}
      alt={profileCharacterLabel(character)}
      draggable={false}
      className={className}
    />
  )
}
