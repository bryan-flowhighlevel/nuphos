import type { ArtifactShareInput } from './artifact-share-types.ts'

/** Publish an artifact version to a public link, read it back, or take it down. */
export const artifactShareApi = {
  agentGetArtifactShare: (sessionId: string, artifactId: string, teamId: string) =>
    window.api.agentGetArtifactShare(sessionId, artifactId, teamId),
  agentPublishArtifactShare: (
    sessionId: string,
    artifactId: string,
    teamId: string,
    input: ArtifactShareInput,
  ) => window.api.agentPublishArtifactShare(sessionId, artifactId, teamId, input),
  agentUnpublishArtifactShare: (sessionId: string, artifactId: string, teamId: string) =>
    window.api.agentUnpublishArtifactShare(sessionId, artifactId, teamId),
}
