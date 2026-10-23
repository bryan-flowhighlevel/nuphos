import { useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'

import { animatedBotAvatarUrl, loadAnimatedBotAvatar } from '../../lib/botAvatarMotion'

import type { BotAvatarFile } from '../../lib/botAvatars'
import type React from 'react'

/**
 * One bot avatar character. `animated` plays the Grok Bot style idle loop;
 * each animated image repaints every frame, so use it where it is seen.
 */
export function BotAvatarImage({
  file,
  animated = false,
  className,
  style,
}: {
  file: BotAvatarFile
  animated?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const reduceMotion = useReducedMotion()
  const live = animated && !reduceMotion
  const [, setLoaded] = useState(0)
  const moving = live ? animatedBotAvatarUrl(file) : undefined

  useEffect(() => {
    if (!live || animatedBotAvatarUrl(file)) return
    let current = true

    void loadAnimatedBotAvatar(file).then((loaded) => {
      if (loaded && current) setLoaded((count) => count + 1)
    })

    return () => {
      current = false
    }
  }, [file, live])

  return (
    <img
      src={moving ?? `/bot-avatars/${file}`}
      alt=""
      draggable={false}
      className={className}
      style={style}
    />
  )
}
