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

/** Any character SVG with the idle loop, starting `delay` seconds in (negative = already playing). */
export function withIdleMotion(
  svg: string,
  delay: number,
  repeat: 'infinite' | '1' = 'infinite',
): string {
  const style =
    `<style>.bot-body,.bot-eye{transform-box:fill-box}` +
    `.bot-body{transform-origin:50% 100%;animation:bot-body ${String(PERIOD_S)}s ${String(delay)}s ${repeat}}` +
    `.bot-eye{transform-origin:50% 50%;animation:bot-eye ${String(PERIOD_S)}s ${String(delay)}s ${repeat}}` +
    `${KEYFRAMES}</style>`

  return svg.replace(/<svg\b[^>]*>/, (open) => open + style)
}

/**
 * The avatar SVG with its idle loop. `loop` repeats it, each character starting at its own
 * point so a sidebar of running agents never moves in lockstep. Otherwise it plays once
 * from the start.
 */
export function withBotAvatarMotion(svg: string, file: BotAvatarFile, loop = true): string {
  if (!loop) return withIdleMotion(svg, 0, '1')

  return withIdleMotion(
    svg,
    -Math.round(((BOT_AVATARS.indexOf(file) * 0.618034) % 1) * PERIOD_S * 100) / 100,
  )
}

/** How long one play of the loop lasts. */
export const BOT_AVATAR_LOOP_MS = PERIOD_S * 1000

const sources = new Map<BotAvatarFile, Promise<string | false>>()
const looping = new Map<BotAvatarFile, string>()

/** The still SVG text of a character, fetched once. False if it could not load. */
export function loadBotAvatarSvg(file: BotAvatarFile): Promise<string | false> {
  const pending =
    sources.get(file) ??
    fetch(`/bot-avatars/${file}`)
      .then((response) => {
        if (!response.ok) throw new Error(`${file}: HTTP ${String(response.status)}`)

        return response.text()
      })
      .catch(() => {
        // A later hover or run may try again; until then the still file shows.
        sources.delete(file)

        return false
      })

  sources.set(file, pending)

  return pending
}

/** The looping copy if it is already built, so a remounted running avatar never blinks still. */
export function readyLoopingBotAvatarUrl(file: BotAvatarFile): string | undefined {
  return looping.get(file)
}

/** The looping copy of a character, shared by every running agent that wears it. */
export async function loopingBotAvatarUrl(file: BotAvatarFile): Promise<string | undefined> {
  const ready = looping.get(file)

  if (ready) return ready
  const svg = await loadBotAvatarSvg(file)

  if (svg === false) return undefined
  const url = looping.get(file) ?? svgUrl(withBotAvatarMotion(svg, file))

  looping.set(file, url)

  return url
}

/**
 * A fresh copy that plays the loop once from the start. Each image URL keeps one
 * animation clock, so a replay needs a new URL; revoke it once the play ends.
 */
export async function playOnceBotAvatarUrl(file: BotAvatarFile): Promise<string | undefined> {
  const svg = await loadBotAvatarSvg(file)

  return svg === false ? undefined : svgUrl(withBotAvatarMotion(svg, file, false))
}

function svgUrl(svg: string): string {
  return URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
}

const ready = new Map<string, string>()
const loading = new Map<string, Promise<boolean>>()

/** The animated copy of the SVG at `src` once it has loaded; undefined until then. */
export function animatedSvgUrl(src: string): string | undefined {
  return ready.get(src)
}

/** Builds the animated copy of `src` once, kept for the life of the window. False if it could not load. */
export function loadAnimatedSvg(src: string, animate: (svg: string) => string): Promise<boolean> {
  const pending =
    loading.get(src) ??
    fetch(src)
      .then((response) => {
        if (!response.ok) throw new Error(`${src}: HTTP ${String(response.status)}`)

        return response.text()
      })
      .then((svg) => {
        ready.set(src, svgUrl(animate(svg)))

        return true
      })
      .catch(() => {
        // A later mount may try again; until then the still file shows.
        loading.delete(src)

        return false
      })

  loading.set(src, pending)

  return pending
}
