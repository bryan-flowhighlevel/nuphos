import { callJsonForRenderer, teamQuery } from './http'

import type { ArtifactShareInput, ArtifactShareResponse } from '../../src/api/artifact-share-types'

const sharePath = (sessionId: string, artifactId: string, teamId: string) =>
  `/agent/conversations/${encodeURIComponent(sessionId)}/artifacts/${encodeURIComponent(artifactId)}/share${teamQuery(teamId)}`

export async function getArtifactShare(sessionId: string, artifactId: string, teamId: string) {
  return callJsonForRenderer<ArtifactShareResponse>('GET', sharePath(sessionId, artifactId, teamId))
}

export async function publishArtifactShare(
  sessionId: string,
  artifactId: string,
  teamId: string,
  input: ArtifactShareInput,
) {
  return callJsonForRenderer<ArtifactShareResponse>(
    'PUT',
    sharePath(sessionId, artifactId, teamId),
    input,
  )
}

export async function unpublishArtifactShare(
  sessionId: string,
  artifactId: string,
  teamId: string,
) {
  return callJsonForRenderer<ArtifactShareResponse>(
    'DELETE',
    sharePath(sessionId, artifactId, teamId),
  )
}
