import { apiUrl } from '../api-endpoint.ts'
import { isValidUserInfo } from '../auth-status.ts'

import { apiErrorMessage, readConfig, writeConfig } from './config.ts'

import type { UserInfo } from '../auth-status.ts'
import type { ProfileCharacter, SetCharacterResult } from '../../src/types/team.ts'

export type ProfileUpdate = { name: string; username: string; avatarURL: string }

export function updateProfile(input: ProfileUpdate) {
  return sendProfileRequest('/auth/me', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
}

/**
 * True when the server does not have this route at all, as opposed to the route
 * answering 404 for a missing record. A desktop build can reach people before the
 * backend that serves its new routes does.
 */
export function isRouteMissing(status: number, body: unknown): boolean {
  if (status === 405) return true
  const code = (body as { error?: { code?: unknown } } | null)?.error?.code

  return status === 404 && (code === undefined || code === 'route_not_found')
}

/** Whether a response means the server has no such route; reads a copy of the body. */
export async function routeMissing(res: Response): Promise<boolean> {
  if (res.status !== 404 && res.status !== 405) return false

  return isRouteMissing(
    res.status,
    await res
      .clone()
      .json()
      .catch(() => undefined),
  )
}

/** Picks the person's profile character, or clears it with null. `unsupported` when the server has no such route yet. */
export async function setCharacter(
  character: ProfileCharacter | null,
): Promise<SetCharacterResult> {
  const { res, token } = await send('/auth/me/character', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ character }),
  })

  if (await routeMissing(res)) return { unsupported: true }

  return { user: await acceptUser(res, token) }
}

export type ProfileLevel = {
  activeDays: number
  xp: number
  level: number
  levelXp: number
  levelSize: number
}

/** The person's level from the days they used Nuphos, counted in their own time zone. Null when the server has no such route yet. */
export async function readLevel(timeZone: string): Promise<ProfileLevel | null> {
  const { res } = await send(`/auth/me/level?timeZone=${encodeURIComponent(timeZone)}`, {
    method: 'GET',
  })

  if (await routeMissing(res)) return null
  if (!res.ok) throw new Error(await apiErrorMessage(res))

  return (await res.json()) as ProfileLevel
}

/** Uploads an already-cropped image; the backend re-encodes it to a 256px WebP. */
export function uploadAvatar(image: Uint8Array) {
  return sendProfileRequest('/auth/me/avatar', {
    method: 'PUT',
    headers: { 'content-type': 'application/octet-stream' },
    body: image,
  })
}

export function removeAvatar() {
  return sendProfileRequest('/auth/me/avatar', { method: 'DELETE' })
}

type RequestInit = { method: string; headers?: Record<string, string>; body?: string | Uint8Array }

async function send(path: string, init: RequestInit) {
  const cfg = await readConfig()

  if (!cfg.token) throw new Error('Please sign in again')
  const res = await fetch(`${apiUrl()}${path}`, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${cfg.token}` },
    signal: AbortSignal.timeout(20_000),
  })

  return { res, token: cfg.token }
}

async function sendProfileRequest(path: string, init: RequestInit) {
  const { res, token } = await send(path, init)

  return acceptUser(res, token)
}

/** The updated user from a profile response, saved as the signed-in user. */
async function acceptUser(res: Response, token: string): Promise<UserInfo> {
  if (!res.ok) throw new Error(await apiErrorMessage(res))
  const user: unknown = await res.json()

  if (!isValidUserInfo(user)) throw new Error('Malformed profile response')
  const current = await readConfig()

  if (current.token !== token) throw new Error('Your sign-in changed; reopen profile settings')
  await writeConfig({ ...current, user: user.name, username: user.username, userInfo: user })

  return user
}
