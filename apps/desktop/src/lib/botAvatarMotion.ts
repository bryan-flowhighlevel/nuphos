import { BOT_AVATARS } from './botAvatars.ts'

import type { BotAvatarFile } from './botAvatars.ts'

const PERIOD_S = 6

// Grok Bot's idle loop: breathe in, glance left, blink, glance right, then a
// squash-and-stretch double hop with happy eyes. Every body frame stays inside
// the 256x256 canvas of the tallest character.
const KEYFRAMES = `@keyframes bot-body{
0%,40%,67%,100%{transform:none;animation-timing-function:ease-in-out}
22%{transform:scale(1.05);animation-timing-function:ease-in-out}
46%{transform:scale(1.09,.9);animation-timing-function:ease-out}
50%{transform:translateY(-4px) scale(.96,1.04);animation-timing-function:ease-out}
53%{transform:translateY(-14px);animation-timing-function:ease-in}
57%{transform:scale(1.08,.92);animation-timing-function:ease-out}
60%{transform:translateY(-7px) scale(.98,1.02);animation-timing-function:ease-in}
63.5%{transform:scale(1.03,.97);animation-timing-function:ease-in-out}
}
@keyframes bot-eye{
0%,14%,72%,100%{transform:none;animation-timing-function:ease-in-out}
20%,25%,28%{transform:translateX(-12px);animation-timing-function:ease-in-out}
26.5%{transform:translateX(-12px) scaleY(.1);animation-timing-function:ease-in-out}
33%,39%{transform:translateX(10px);animation-timing-function:ease-in-out}
43%,66%{transform:scale(1.2,.5);animation-timing-function:ease-in-out}
}`

/** The avatar SVG with its idle loop. Each character starts at its own point so a grid never moves in lockstep. */
export function withBotAvatarMotion(svg: string, file: BotAvatarFile): string {
  const delay = -Math.round(((BOT_AVATARS.indexOf(file) * 0.618034) % 1) * PERIOD_S * 100) / 100
  const style =
    `<style>.bot-body,.bot-eye{transform-box:fill-box}` +
    `.bot-body{transform-origin:50% 100%;animation:bot-body ${String(PERIOD_S)}s ${String(delay)}s infinite}` +
    `.bot-eye{transform-origin:50% 50%;animation:bot-eye ${String(PERIOD_S)}s ${String(delay)}s infinite}` +
    `${KEYFRAMES}</style>`

  return svg.replace(/<svg\b[^>]*>/, (open) => open + style)
}

const ready = new Map<BotAvatarFile, string>()
const loading = new Map<BotAvatarFile, Promise<boolean>>()

/** The animated copy of a character once it has loaded; undefined until then. */
export function animatedBotAvatarUrl(file: BotAvatarFile): string | undefined {
  return ready.get(file)
}

/** Builds the animated copy once per character, kept for the life of the window. False if it could not load. */
export function loadAnimatedBotAvatar(file: BotAvatarFile): Promise<boolean> {
  const pending =
    loading.get(file) ??
    fetch(`/bot-avatars/${file}`)
      .then((response) => {
        if (!response.ok) throw new Error(`bot avatar ${file}: HTTP ${String(response.status)}`)

        return response.text()
      })
      .then((svg) => {
        const blob = new Blob([withBotAvatarMotion(svg, file)], { type: 'image/svg+xml' })

        ready.set(file, URL.createObjectURL(blob))

        return true
      })
      .catch(() => {
        // A later mount may try again; until then the still file shows.
        loading.delete(file)

        return false
      })

  loading.set(file, pending)

  return pending
}
