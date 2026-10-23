// Published artifacts: one public link per artifact in a conversation. A link
// shows the version it was last published at; publishing another version keeps
// the link and swaps what it shows, and unpublishing deletes it.
//
// What a link shows always comes from the conversation's own render_artifact
// call, never from the request: publishing can only put on the web what the
// agent made.
import { randomBytes } from 'node:crypto'

import { z } from 'zod'

import { config } from '@/config'
import { ARTIFACT_KINDS } from '@/lib/agent/tools-skilled/artifact-tool'
import { db } from '@/lib/db'

import type { Collection } from 'mongodb'

export type ArtifactKind = (typeof ARTIFACT_KINDS)[number]

export type ArtifactShare = {
  shareId: string
  teamId: string
  sessionId: string
  artifactId: string
  version: number
  title: string
  kind: ArtifactKind
  language?: string
  content: string
  publishedBy: string
  publishedByName: string
  createdAt: Date
  updatedAt: Date
}

/** What the desktop sees of a share: never the content it already holds. */
export type ArtifactShareView = {
  shareId: string
  url: string
  version: number
  title: string
  publishedAt: string
  publishedByName: string
}

export const ARTIFACT_ID = /^[a-z0-9][a-z0-9-]{0,63}$/
export const SHARE_ID = /^[A-Za-z0-9]{22}$/

export const ARTIFACT_TOOL = 'render_artifact'

/** Only which version to publish. Anything else a client sends is dropped. */
export const artifactShareInput = z.object({
  teamId: z.string().optional(),
  version: z.number().int().min(1).max(10_000),
})

/** One version of an artifact, as its render_artifact call made it. */
export type ArtifactVersionContent = {
  version: number
  title: string
  kind: ArtifactKind
  language?: string
  content: string
}

const artifactCallInput = z.object({
  artifactId: z.string().regex(ARTIFACT_ID),
  title: z.string().trim().min(1),
  kind: z.enum(ARTIFACT_KINDS),
  language: z.string().optional(),
  content: z.string().min(1),
})

/**
 * Version `version` of `artifactId` in the conversation's messages, numbered
 * the way the desktop numbers them: every render_artifact call for the id, in
 * order, except one that failed or carried no valid artifact.
 */
export function artifactVersionFromMessages(
  messages: readonly { parts: readonly unknown[] }[],
  artifactId: string,
  version: number,
): ArtifactVersionContent | null {
  let seen = 0

  for (const message of messages) {
    for (const part of message.parts) {
      const call = part as Record<string, unknown>

      if (call.type !== 'tool' || call.toolName !== ARTIFACT_TOOL || !call.toolCallId) continue
      if (call.state === 'output-error') continue
      const input = artifactCallInput.safeParse(call.input)

      if (!input.success || input.data.artifactId !== artifactId) continue
      seen += 1
      if (seen !== version) continue
      const { title, kind, language, content } = input.data

      return {
        version,
        title,
        kind,
        ...(kind === 'code' && language?.trim() ? { language: language.trim() } : {}),
        content,
      }
    }
  }

  return null
}

const shares = (): Collection<ArtifactShare> =>
  db().collection<ArtifactShare>('agent_artifact_shares')

export async function setupArtifactShareIndexes(): Promise<void> {
  await shares().createIndex({ shareId: 1 }, { unique: true, background: true })
  await shares().createIndex({ sessionId: 1, artifactId: 1 }, { unique: true, background: true })
}

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/** 22 base62 characters: about 130 bits, so links cannot be guessed. */
export function newShareId(): string {
  const bytes = randomBytes(22)

  return [...bytes].map((byte) => BASE62[byte % 62]).join('')
}

export function artifactShareUrl(shareId: string): string {
  return `${config.auth.publicBaseUrl}/artifact/${shareId}`
}

export function artifactShareView(share: ArtifactShare): ArtifactShareView {
  return {
    shareId: share.shareId,
    url: artifactShareUrl(share.shareId),
    version: share.version,
    title: share.title,
    publishedAt: share.updatedAt.toISOString(),
    publishedByName: share.publishedByName,
  }
}

export async function findArtifactShare(
  sessionId: string,
  artifactId: string,
): Promise<ArtifactShare | null> {
  return await shares().findOne({ sessionId, artifactId })
}

export async function findPublicArtifactShare(shareId: string): Promise<ArtifactShare | null> {
  if (!SHARE_ID.test(shareId)) return null

  return await shares().findOne({ shareId })
}

export async function publishArtifactShare(args: {
  teamId: string
  sessionId: string
  artifactId: string
  input: ArtifactVersionContent
  publishedBy: { id: string; name: string }
}): Promise<ArtifactShare> {
  const { teamId, sessionId, artifactId, input, publishedBy } = args
  const now = new Date()
  const language = input.kind === 'code' ? input.language?.toLowerCase() : undefined
  const result = await shares().findOneAndUpdate(
    { sessionId, artifactId },
    {
      $set: {
        teamId,
        version: input.version,
        title: input.title,
        kind: input.kind,
        content: input.content,
        publishedBy: publishedBy.id,
        publishedByName: publishedBy.name,
        updatedAt: now,
        ...(language ? { language } : {}),
      },
      ...(language ? {} : { $unset: { language: '' } }),
      $setOnInsert: { shareId: newShareId(), sessionId, artifactId, createdAt: now },
    },
    { upsert: true, returnDocument: 'after' },
  )

  if (!result) throw new Error('artifact share upsert returned nothing')

  return result
}

export async function unpublishArtifactShare(sessionId: string, artifactId: string) {
  await shares().deleteOne({ sessionId, artifactId })
}
