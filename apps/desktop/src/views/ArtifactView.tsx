import { AppWindow, FileCode2, FileText, Image, Shapes } from 'lucide-react'
import { useState } from 'react'

import { PageMeta } from '../app/pageMeta'
import { ArtifactFrame } from '../components/agent/artifacts/ArtifactFrame'
import { artifactSourceLanguage, fencedSource } from '../components/agent/artifacts/artifactPayload'
import { svgDataUrl } from '../components/agent/artifacts/artifactSandbox'
import { ArtifactToolbar } from '../components/agent/artifacts/ArtifactToolbar'
import { ARTIFACT_DOCUMENT_TYPE } from '../components/agent/artifacts/artifactTypography'
import { useArtifactShare } from '../components/agent/artifacts/useArtifactShare'
import {
  useArtifactLine,
  usePickedArtifactVersion,
} from '../components/agent/artifacts/useSessionArtifacts'
import { MessageResponse } from '../components/agent/MessageResponse'
import { EmptyState } from '../components/EmptyState'
import { useWorkspaceTab } from '../hooks/useWorkspaceTab'
import { ARTIFACT_PAGE, pickArtifactVersion } from '../lib/sessionArtifacts'

import type { ArtifactKind, ArtifactVersion } from '../components/agent/artifacts/artifactPayload'
import type { ArtifactViewMode } from '../components/agent/artifacts/ArtifactToolbar'
import type { LucideIcon } from 'lucide-react'

const KIND_ICONS: Record<ArtifactKind, LucideIcon> = {
  html: AppWindow,
  markdown: FileText,
  svg: Image,
  code: FileCode2,
}

const MAX_ERRORS = 5

/** Errors a version's page reported, by version number (see sessionArtifacts on call ids). */
type FrameErrors = { version: number; messages: string[] }

/** An artifact the agent showed in this tab's chat, in the dock beside it. */
export function ArtifactView({
  teamId,
  artifactId,
  onAskAgent,
}: {
  teamId: string
  artifactId: string
  onAskAgent: (prompt: string) => void
}) {
  const { conversationId, isActive } = useWorkspaceTab()
  const line = useArtifactLine(conversationId, artifactId)
  const picked = usePickedArtifactVersion(conversationId, artifactId)
  const current = line.find((entry) => entry.version === picked) ?? line.at(-1)
  const [view, setView] = useState<ArtifactViewMode>('preview')
  const share = useArtifactShare(teamId, conversationId, artifactId)
  const [errors, setErrors] = useState<FrameErrors | null>(null)
  const Icon = current ? KIND_ICONS[current.kind] : Shapes

  const recordError = (version: number, message: string) => {
    setErrors((before) => {
      const messages = before?.version === version ? before.messages : []

      if (messages.includes(message) || messages.length >= MAX_ERRORS) return before

      return { version, messages: [...messages, message] }
    })
  }

  return (
    <PageMeta
      pageKey={ARTIFACT_PAGE}
      title={current?.title ?? 'Artifact'}
      icon={<Icon className="h-3.5 w-3.5" />}
      iconKey={current?.kind ?? 'none'}
    >
      {current ? (
        <>
          <ArtifactToolbar
            active={isActive}
            line={line}
            current={current}
            view={view}
            errors={errors?.version === current.version ? errors.messages : []}
            share={share}
            onView={setView}
            onStep={(next) => {
              if (!conversationId) return
              pickArtifactVersion(
                conversationId,
                artifactId,
                next === line.at(-1) ? null : next.version,
              )
            }}
            onAskAgent={onAskAgent}
          />
          <ArtifactBody
            version={current}
            view={current.kind === 'code' ? 'source' : view}
            onError={(message) => recordError(current.version, message)}
          />
        </>
      ) : (
        <EmptyState
          icon={Shapes}
          title="Artifact not loaded"
          description="Open it from its card in the chat. Cards further up load once you scroll back to them."
        />
      )}
    </PageMeta>
  )
}

function ArtifactBody({
  version,
  view,
  onError,
}: {
  version: ArtifactVersion
  view: ArtifactViewMode
  onError: (message: string) => void
}) {
  if (view === 'source') {
    return (
      <div className="min-h-0 flex-1 overflow-auto scrollbar-thin px-4 py-3">
        <MessageResponse>
          {fencedSource(version.content, artifactSourceLanguage(version))}
        </MessageResponse>
      </div>
    )
  }
  if (version.kind === 'html') {
    return (
      <div className="flex min-h-0 flex-1">
        <ArtifactFrame
          key={version.version}
          html={version.content}
          title={version.title}
          className="h-full w-full"
          onError={onError}
        />
      </div>
    )
  }
  if (version.kind === 'svg') {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-white p-8">
        <img
          src={svgDataUrl(version.content)}
          alt={version.title}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto scrollbar-thin">
      <article className="mx-auto w-full max-w-[72ch] px-8 pb-16 pt-10">
        <MessageResponse className={ARTIFACT_DOCUMENT_TYPE}>{version.content}</MessageResponse>
      </article>
    </div>
  )
}
