import {
  ARTIFACT_ID,
  artifactShareInput,
  artifactShareView,
  findArtifactShare,
  publishArtifactShare,
  unpublishArtifactShare,
} from '@/lib/agent/artifact-shares'
import { Hono } from 'hono'

import { getReadableConversation } from '@/lib/agent/db'
import { AppError } from '@/lib/errors'
import { tokenTeamScope } from '@/lib/identity/token-team-scope'

import { readTeamIdCandidate, resolveVerifiedTeamId } from './team-scope'

import type { AuthVariables } from '@/middleware/auth'
import type { Context } from 'hono'

type AuthContext = Context<{ Variables: AuthVariables }>

export const artifactShareRoutes = new Hono<{ Variables: AuthVariables }>()

// Anyone who can read a conversation can see, publish and unpublish the links
// to its artifacts. Publishing puts content on the open web, so it is a
// person's decision: an agent or runtime token may look, never publish.

async function readableArtifact(c: AuthContext, bodyTeamId?: unknown) {
  const teamId = await resolveVerifiedTeamId(c, readTeamIdCandidate(c, bodyTeamId))

  if (!teamId) throw new AppError(400, 'team_required', 'A team is required')
  const sessionId = c.req.param('sessionId') ?? ''
  const artifactId = c.req.param('artifactId') ?? ''

  if (!ARTIFACT_ID.test(artifactId)) {
    throw new AppError(400, 'invalid_request', 'artifactId is not a valid artifact id')
  }
  const conversation = await getReadableConversation(sessionId, c.get('userId'), teamId)

  if (!conversation) throw new AppError(404, 'not_found', 'Conversation not found')

  return { teamId, sessionId, artifactId }
}

function requirePerson(c: AuthContext) {
  if (tokenTeamScope() || c.get('previewConversationOwnerUserId') || c.get('cliToken')) {
    throw new AppError(403, 'forbidden', 'Only a person can publish an artifact to the web')
  }
}

artifactShareRoutes.get('/conversations/:sessionId/artifacts/:artifactId/share', async (c) => {
  const { sessionId, artifactId } = await readableArtifact(c)
  const share = await findArtifactShare(sessionId, artifactId)

  return c.json({ share: share ? artifactShareView(share) : null })
})

artifactShareRoutes.put('/conversations/:sessionId/artifacts/:artifactId/share', async (c) => {
  requirePerson(c)
  const body: unknown = await c.req.json().catch(() => null)
  const parsed = artifactShareInput.safeParse(body)

  if (!parsed.success) throw new AppError(400, 'invalid_request', parsed.error.message)
  const { teamId, sessionId, artifactId } = await readableArtifact(c, parsed.data.teamId)
  const share = await publishArtifactShare({
    teamId,
    sessionId,
    artifactId,
    input: parsed.data,
    publishedBy: { id: c.get('userId'), name: c.get('userName') },
  })

  return c.json({ share: artifactShareView(share) })
})

artifactShareRoutes.delete('/conversations/:sessionId/artifacts/:artifactId/share', async (c) => {
  requirePerson(c)
  const { sessionId, artifactId } = await readableArtifact(c)

  await unpublishArtifactShare(sessionId, artifactId)

  return c.json({ share: null })
})
