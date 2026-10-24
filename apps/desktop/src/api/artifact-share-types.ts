/** A published artifact link, as the backend reports it. The content stays on the desktop. */
export type ArtifactShare = {
  shareId: string
  url: string
  version: number
  title: string
  publishedAt: string
  publishedByName: string
}

export type ArtifactShareResponse = {
  share: ArtifactShare | null
  /** False until the server has a separate artifact origin; absent from older servers. */
  htmlSharing?: boolean
}

/** Which version to publish: the backend reads the artifact from the saved conversation. */
export type ArtifactShareInput = { version: number }
