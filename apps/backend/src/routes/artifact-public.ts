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
import {
  canShareKind,
  findPublicArtifactShare,
  servesArtifactHost,
} from '@/lib/agent/artifact-shares'

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

// With an artifact origin set, these pages exist only on its host: on the API
// or product host a link is just not found.
artifactPublicRoutes.use('*', async (c, next) => {
  if (!servesArtifactHost(c.req.url)) return notFound()
  await next()
})

/** A share this host may show as a page: a page only with an artifact origin. */
async function viewableShare(shareId: string) {
  const share = await findPublicArtifactShare(shareId)

  return share && canShareKind(share.kind) ? share : null
}

artifactPublicRoutes.get('/:shareId', async (c) => {
  const share = await viewableShare(c.req.param('shareId'))

  if (!share) return notFound()
  const nonce = randomBytes(16).toString('base64')

  return c.html(artifactSharePage(share, nonce), 200, artifactPageHeaders(nonce))
})

// The raw document runs the artifact's own scripts, so it is only served into
// the share page's frame. Opened as a page of its own it would sit on this
// origin with none of the viewer's framing, so a browser navigating to it, or
// a client that does not say where it will be shown, gets a refusal.
artifactPublicRoutes.get('/:shareId/raw', async (c) => {
  if (c.req.header('Sec-Fetch-Dest') !== 'iframe') {
    return c.text('This artifact opens only inside its share page.', 403, {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    })
  }
  const share = await viewableShare(c.req.param('shareId'))

  if (!share) return notFound()

  return c.body(artifactRawDocument(share), 200, artifactRawHeaders(share.kind))
})

artifactPublicRoutes.get('/:shareId/source', async (c) => {
  const share = await findPublicArtifactShare(c.req.param('shareId'))

  if (!share) return notFound()

  return c.body(share.content, 200, artifactSourceHeaders(share, c.req.query('download') === '1'))
})
