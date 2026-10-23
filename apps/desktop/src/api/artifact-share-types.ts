/** A published artifact link, as the backend reports it. The content stays on the desktop. */
export type ArtifactShare = {
  shareId: string
  url: string
  version: number
  title: string
  publishedAt: string
  publishedByName: string
}

export type ArtifactShareResponse = { share: ArtifactShare | null }

/** The version being published: the backend serves exactly this. */
export type ArtifactShareInput = {
  version: number
  title: string
  kind: 'html' | 'markdown' | 'svg' | 'code'
  language?: string
  content: string
}
