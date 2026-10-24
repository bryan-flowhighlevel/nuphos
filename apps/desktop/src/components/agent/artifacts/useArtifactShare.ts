import { useCallback, useEffect, useState } from 'react'

import { api } from '../../../api'
import { toast } from '../../ui/toast'

import type { ArtifactVersion } from './artifactPayload'
import type { ArtifactShare } from '../../../api'

/**
 * The public link for one artifact: read when its tab opens, so the Share
 * button can say it is live, and replaced by whatever publishing returns.
 */
export function useArtifactShare(
  teamId: string | undefined,
  sessionId: string | null | undefined,
  artifactId: string,
) {
  const key = teamId && sessionId ? `${teamId}:${sessionId}:${artifactId}` : null
  // Tagged with the artifact it was read for, so a tab moving to another
  // artifact reads as loading again rather than showing the last one's link.
  const [read, setRead] = useState<{
    key: string
    share: ArtifactShare | null
    htmlSharing: boolean
  } | null>(null)
  const [pending, setPending] = useState<'publish' | 'unpublish' | null>(null)
  const loaded = read !== null && read.key === key
  const share = loaded ? read.share : null
  // A server that does not say lets pages be shared, as it always did.
  const htmlSharing = loaded ? read.htmlSharing : true
  const setShare = useCallback(
    (next: ArtifactShare | null) => {
      if (key) setRead((prev) => ({ key, share: next, htmlSharing: prev?.htmlSharing ?? true }))
    },
    [key],
  )

  useEffect(() => {
    if (!teamId || !sessionId || !key) return
    let cancelled = false
    const settle = (next: ArtifactShare | null, htmlSharing = true) => {
      if (!cancelled) setRead({ key, share: next, htmlSharing })
    }

    api
      .agentGetArtifactShare(sessionId, artifactId, teamId)
      .then((res) => settle(res.share, res.htmlSharing ?? true))
      // No link state is the right outcome; Share still offers to publish.
      .catch(() => settle(null))

    return () => {
      cancelled = true
    }
  }, [key, teamId, sessionId, artifactId])

  const publish = useCallback(
    async (version: ArtifactVersion) => {
      if (!teamId || !sessionId) return
      setPending('publish')
      try {
        const res = await api.agentPublishArtifactShare(sessionId, artifactId, teamId, {
          version: version.version,
        })

        setShare(res.share)
      } catch (err) {
        toast.apiError('Could not publish the artifact', err)
      } finally {
        setPending(null)
      }
    },
    [teamId, sessionId, artifactId, setShare],
  )

  const unpublish = useCallback(async () => {
    if (!teamId || !sessionId) return
    setPending('unpublish')
    try {
      await api.agentUnpublishArtifactShare(sessionId, artifactId, teamId)
      setShare(null)
    } catch (err) {
      toast.apiError('Could not unpublish the artifact', err)
    } finally {
      setPending(null)
    }
  }, [teamId, sessionId, artifactId, setShare])

  return {
    share,
    loaded,
    pending,
    htmlSharing,
    canShare: Boolean(teamId && sessionId),
    publish,
    unpublish,
  }
}

export type ArtifactShareState = ReturnType<typeof useArtifactShare>
