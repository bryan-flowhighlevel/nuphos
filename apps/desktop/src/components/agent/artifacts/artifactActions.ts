// What the artifact tab's toolbar does with a version.
import { toast } from '../../ui/toast'

import { artifactFileName, artifactMimeType } from './artifactPayload'

import type { ArtifactVersion } from './artifactPayload'

export function fixPrompt(version: ArtifactVersion, errors: string[]): string {
  const list = errors.map((message) => `- ${message}`).join('\n')
  const subject = errors.length === 1 ? 'this error' : 'these errors'

  return `The artifact "${version.title}" (version ${String(version.version)}) reports ${subject} in its preview:\n\n${list}\n\nPlease fix it and show the new version.`
}

export async function copySource(version: ArtifactVersion) {
  try {
    await navigator.clipboard.writeText(version.content)
    toast.success('Copied', version.title)
  } catch {
    toast.error('Could not copy the artifact')
  }
}

export function downloadArtifact(version: ArtifactVersion) {
  const url = URL.createObjectURL(
    new Blob([version.content], { type: `${artifactMimeType(version.kind)};charset=utf-8` }),
  )
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = artifactFileName(version)
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
