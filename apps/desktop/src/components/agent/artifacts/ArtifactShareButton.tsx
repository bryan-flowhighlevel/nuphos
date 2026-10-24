import { Popover } from '@base-ui/react/popover'
import clsx from 'clsx'
import { ExternalLink, Globe } from 'lucide-react'

import { api } from '../../../api'
import { Button } from '../../ui/button'
import { toast } from '../../ui/toast'
import { ShareLink, TitlebarDragSuspender } from '../ShareCard'

import type { ArtifactVersion } from './artifactPayload'
import type { ArtifactShareState } from './useArtifactShare'

const TRIGGER =
  'titlebar-no-drag relative flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-zGray-800 px-2 text-[12px] font-medium text-secondary outline-none transition-colors hover:bg-zGray-800/60 hover:text-main focus-visible:ring-2 focus-visible:ring-zViolet-accent data-[popup-open]:bg-zGray-800/60 data-[popup-open]:text-main disabled:opacity-50'

function openLink(url: string) {
  void api.appOpenExternal(url).catch(() => toast.error('Could not open the link'))
}

/** Publish the version on screen to a public link, like a Claude artifact's Publish. */
export function ArtifactShareButton({
  current,
  state,
  iconOnly = false,
}: {
  current: ArtifactVersion
  state: ArtifactShareState
  /** A narrow dock keeps the globe and drops the word. */
  iconOnly?: boolean
}) {
  const { share, canShare } = state
  const triggerLabel = share ? 'Shared' : 'Share'

  return (
    <Popover.Root>
      <Popover.Trigger
        className={clsx(TRIGGER, iconOnly && 'w-7 justify-center px-0')}
        disabled={!canShare}
        title={share ? 'Shared on the web' : 'Share this artifact on the web'}
      >
        <Globe className="h-3.5 w-3.5" strokeWidth={1.8} />
        {iconOnly ? <span className="sr-only">{triggerLabel}</span> : triggerLabel}
        {share && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-main bg-success"
          />
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <TitlebarDragSuspender />
        <Popover.Positioner align="end" sideOffset={6} collisionPadding={12} className="z-[1000]">
          <Popover.Popup
            className={(popup) =>
              clsx(
                't-dropdown w-[320px] rounded-xl border border-zGray-800/60 bg-main p-3 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.6)] outline-none',
                popup.open && 'is-open',
                popup.transitionStatus === 'ending' && 'is-closing',
              )
            }
            style={{ transformOrigin: 'top right' }}
          >
            <div className="mb-3 flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zGray-850 text-secondary">
                <Globe className="h-4 w-4" strokeWidth={1.8} />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <Popover.Title className="m-0 text-[13.5px] font-medium text-main">
                  {share ? 'Published to the web' : 'Publish to the web'}
                </Popover.Title>
                <Popover.Description className="m-0 text-[12px] leading-5 text-tertiary">
                  Anyone with the link can view it, without signing in. Pages run in a sandbox.
                </Popover.Description>
              </span>
            </div>
            <ShareBody current={current} state={state} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

function ShareBody({ current, state }: { current: ArtifactVersion; state: ArtifactShareState }) {
  const { share, loaded, pending, htmlSharing, publish, unpublish } = state
  const stale = share !== null && share.version !== current.version

  if (!loaded) {
    return <div className="h-[60px] animate-pulse rounded-lg bg-zGray-850/60" aria-hidden />
  }
  if (!share && current.kind === 'html' && !htmlSharing) {
    return (
      <p className="m-0 rounded-lg bg-zGray-850/60 px-3 py-2.5 text-[12px] leading-5 text-secondary">
        Pages can&apos;t be published yet. They run their own code, so Nuphos shares them from a
        separate web address, and this server doesn&apos;t have one yet. Documents, code and
        diagrams can be published now, and you can still download this page.
      </p>
    )
  }
  if (!share) {
    return (
      <Button className="w-full" disabled={pending !== null} onClick={() => void publish(current)}>
        {pending === 'publish' ? 'Publishing…' : `Publish version ${String(current.version)}`}
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      <ShareLink url={share.url}>
        <div className="px-2.5 py-1.5 text-[11.5px] text-tertiary">
          Shows version {share.version}
          {stale && ` · you're viewing version ${String(current.version)}`}
        </div>
      </ShareLink>
      {stale && (
        <Button size="sm" disabled={pending !== null} onClick={() => void publish(current)}>
          {pending === 'publish' ? 'Updating…' : `Show version ${String(current.version)} instead`}
        </Button>
      )}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" className="-ml-1" onClick={() => openLink(share.url)}>
          <ExternalLink className="h-3.5 w-3.5" />
          Open in browser
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="-mr-1"
          disabled={pending !== null}
          onClick={() => void unpublish()}
        >
          {pending === 'unpublish' ? 'Unpublishing…' : 'Unpublish'}
        </Button>
      </div>
    </div>
  )
}
