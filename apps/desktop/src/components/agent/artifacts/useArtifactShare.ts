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
  const [read, setRead] = useState<{ key: string; share: ArtifactShare | null } | null>(null)
  const [pending, setPending] = useState<'publish' | 'unpublish' | null>(null)
  const loaded = read !== null && read.key === key
  const share = loaded ? read.share : null
  const setShare = useCallback(
    (next: ArtifactShare | null) => {
      if (key) setRead({ key, share: next })
    },
    [key],
  )

  useEffect(() => {
    if (!teamId || !sessionId || !key) return
    let cancelled = false
    const settle = (next: ArtifactShare | null) => {
      if (!cancelled) setRead({ key, share: next })
    }

    api
      .agentGetArtifactShare(sessionId, artifactId, teamId)
      .then((res) => settle(res.share))
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
          title: version.title,
          kind: version.kind,
          ...(version.language ? { language: version.language } : {}),
          content: version.content,
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

  return { share, loaded, pending, canShare: Boolean(teamId && sessionId), publish, unpublish }
}

export type ArtifactShareState = ReturnType<typeof useArtifactShare>
