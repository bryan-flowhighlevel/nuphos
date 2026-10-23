import { ipcRenderer } from 'electron'

import type { GeneralAccess, ParticipantRole } from '../../src/api/agent-types'
import type { ArtifactShareInput } from '../../src/api/artifact-share-types'

export const sessionAccessApi = {
  agentGetSessionResources: (sessionId: string, teamId: string) =>
    ipcRenderer.invoke('agent:getSessionResources', sessionId, teamId),
  agentUnlinkSessionResource: (sessionId: string, teamId: string, resourceId: string) =>
    ipcRenderer.invoke('agent:unlinkSessionResource', sessionId, teamId, resourceId),
  agentGetConversationParticipants: (sessionId: string, teamId?: string) =>
    ipcRenderer.invoke('agent:getConversationParticipants', sessionId, teamId),
  agentInviteConversationParticipants: (
    sessionId: string,
    teamId: string,
    userIds: string[],
    role: ParticipantRole,
  ) => ipcRenderer.invoke('agent:inviteConversationParticipants', sessionId, teamId, userIds, role),
  agentSetConversationParticipantRole: (
    sessionId: string,
    teamId: string,
    userId: string,
    role: ParticipantRole,
  ) => ipcRenderer.invoke('agent:setConversationParticipantRole', sessionId, teamId, userId, role),
  agentSetConversationGeneralAccess: (
    sessionId: string,
    teamId: string,
    generalAccess: GeneralAccess,
  ) => ipcRenderer.invoke('agent:setConversationGeneralAccess', sessionId, teamId, generalAccess),
  agentRemoveConversationParticipant: (sessionId: string, teamId: string, userId: string) =>
    ipcRenderer.invoke('agent:removeConversationParticipant', sessionId, teamId, userId),
  agentGetArtifactShare: (sessionId: string, artifactId: string, teamId: string) =>
    ipcRenderer.invoke('agent:getArtifactShare', sessionId, artifactId, teamId),
  agentPublishArtifactShare: (
    sessionId: string,
    artifactId: string,
    teamId: string,
    input: ArtifactShareInput,
  ) => ipcRenderer.invoke('agent:publishArtifactShare', sessionId, artifactId, teamId, input),
  agentUnpublishArtifactShare: (sessionId: string, artifactId: string, teamId: string) =>
    ipcRenderer.invoke('agent:unpublishArtifactShare', sessionId, artifactId, teamId),
}
