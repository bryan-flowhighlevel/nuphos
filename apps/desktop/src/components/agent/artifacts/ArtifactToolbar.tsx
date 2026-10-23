import { Toggle } from '@base-ui/react/toggle'
import { ToggleGroup } from '@base-ui/react/toggle-group'
import { ChevronLeft, ChevronRight, Code2, Copy, Download, Eye, Wrench } from 'lucide-react'
import { createPortal } from 'react-dom'

import { useToolbarSlot } from '../../../hooks/useToolbarControls'
import { Button } from '../../ui/button'
import { Tooltip } from '../../ui/tooltip'

import { copySource, downloadArtifact, fixPrompt } from './artifactActions'
import { artifactFileName, artifactKindLabel } from './artifactPayload'
import { ArtifactShareButton } from './ArtifactShareButton'

import type { ArtifactVersion } from './artifactPayload'
import type { ArtifactShareState } from './useArtifactShare'

export type ArtifactViewMode = 'preview' | 'source'

const SEGMENT =
  'inline-flex h-[26px] w-8 items-center justify-center text-secondary outline-none transition-colors hover:text-main focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zViolet-accent data-[pressed]:bg-zGray-800 data-[pressed]:text-main'

/**
 * The title takes whatever room is left, so it is the last thing to shorten.
 * Everything else is a fixed-size control with its name in a tooltip.
 */
export function ArtifactToolbar({
  active,
  line,
  current,
  view,
  errors,
  share,
  onView,
  onStep,
  onAskAgent,
}: {
  active: boolean
  line: readonly ArtifactVersion[]
  current: ArtifactVersion
  view: ArtifactViewMode
  errors: string[]
  share: ArtifactShareState
  onView: (view: ArtifactViewMode) => void
  onStep: (version: ArtifactVersion) => void
  onAskAgent: (prompt: string) => void
}) {
  const leftSlot = useToolbarSlot('left', active)
  const rightSlot = useToolbarSlot('right', active)

  return (
    <>
      {leftSlot &&
        createPortal(
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className="min-w-[3rem] truncate text-[13px] font-medium text-main"
              title={current.title}
            >
              {current.title}
            </span>
            <VersionStepper line={line} current={current} onStep={onStep} />
          </div>,
          leftSlot,
        )}
      {rightSlot &&
        createPortal(
          <div className="flex shrink-0 items-center gap-1">
            {errors.length > 0 && (
              <Tooltip content={`Ask the agent to fix: ${errors.join(' · ')}`}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="relative h-7 w-7 text-warning hover:text-warning"
                  aria-label={`Ask the agent to fix ${String(errors.length)} error${errors.length === 1 ? '' : 's'}`}
                  onClick={() => onAskAgent(fixPrompt(current, errors))}
                >
                  <Wrench className="h-3.5 w-3.5" />
                  <span
                    aria-hidden
                    className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-warning"
                  />
                </Button>
              </Tooltip>
            )}
            {current.kind !== 'code' && (
              <ToggleGroup
                value={[view]}
                onValueChange={(value) => {
                  const chosen = value[0] as ArtifactViewMode | undefined

                  if (chosen) onView(chosen)
                }}
                aria-label="Show"
                className="mr-1 inline-flex divide-x divide-zGray-800 overflow-hidden rounded-md border border-zGray-800"
              >
                <Tooltip content="Preview">
                  <Toggle value="preview" aria-label="Preview" className={SEGMENT}>
                    <Eye className="h-3.5 w-3.5" />
                  </Toggle>
                </Tooltip>
                <Tooltip content="Code">
                  <Toggle value="source" aria-label="Code" className={SEGMENT}>
                    <Code2 className="h-3.5 w-3.5" />
                  </Toggle>
                </Tooltip>
              </ToggleGroup>
            )}
            <Tooltip content={`Copy the ${artifactKindLabel(current).toLowerCase()} source`}>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7"
                aria-label="Copy"
                onClick={() => void copySource(current)}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
            <Tooltip content={`Download ${artifactFileName(current)}`}>
              <Button
                variant="ghost"
                size="icon-sm"
                className="mr-1 h-7 w-7"
                aria-label="Download"
                onClick={() => downloadArtifact(current)}
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
            <ArtifactShareButton current={current} state={share} />
          </div>,
          rightSlot,
        )}
    </>
  )
}

function VersionStepper({
  line,
  current,
  onStep,
}: {
  line: readonly ArtifactVersion[]
  current: ArtifactVersion
  onStep: (version: ArtifactVersion) => void
}) {
  if (line.length < 2) return null
  const index = line.indexOf(current)
  const previous = index > 0 ? line.at(index - 1) : undefined
  const next = line.at(index + 1)

  return (
    <div className="flex shrink-0 items-center" role="group" aria-label="Versions">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Previous version"
        disabled={!previous}
        onClick={() => previous && onStep(previous)}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </Button>
      <span
        className="whitespace-nowrap px-0.5 text-[12px] tabular-nums text-secondary"
        aria-live="polite"
        title={`Version ${String(current.version)} of ${String(line.length)}`}
      >
        v{current.version} of {line.length}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Next version"
        disabled={!next}
        onClick={() => next && onStep(next)}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
