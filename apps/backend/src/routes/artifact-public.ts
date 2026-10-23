import { randomBytes } from 'node:crypto'

import { Hono } from 'hono'

import { artifactRawDocument } from '@/lib/agent/artifact-share-documents'
import {
  artifactNotFoundPage,
  artifactPageHeaders,
  artifactRawHeaders,
  artifactSharePage,
  artifactSourceHeaders,
} from '@/lib/agent/artifact-share-page'
import { findPublicArtifactShare } from '@/lib/agent/artifact-shares'

/*
 * Public pages behind an artifact share link: no auth, by design. A link is
 * an unguessable id that someone in the team chose to publish; unpublishing
 * deletes it. See lib/agent/artifact-share-page.ts for how the artifact is
 * kept off this origin.
 */
export const artifactPublicRoutes = new Hono()

function notFound() {
  return new Response(artifactNotFoundPage(), {
    status: 404,
    headers: { ...artifactPageHeaders(''), 'Content-Type': 'text/html; charset=utf-8' },
  })
}

artifactPublicRoutes.get('/:shareId', async (c) => {
  const share = await findPublicArtifactShare(c.req.param('shareId'))

  if (!share) return notFound()
  const nonce = randomBytes(16).toString('base64')

  return c.html(artifactSharePage(share, nonce), 200, artifactPageHeaders(nonce))
})

artifactPublicRoutes.get('/:shareId/raw', async (c) => {
  const share = await findPublicArtifactShare(c.req.param('shareId'))

  if (!share) return notFound()

  return c.body(artifactRawDocument(share), 200, artifactRawHeaders(share.kind))
})

artifactPublicRoutes.get('/:shareId/source', async (c) => {
  const share = await findPublicArtifactShare(c.req.param('shareId'))

  if (!share) return notFound()

  return c.body(share.content, 200, artifactSourceHeaders(share, c.req.query('download') === '1'))
})
