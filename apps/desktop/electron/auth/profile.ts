import { apiUrl } from '../api-endpoint.ts'
import { isValidUserInfo } from '../auth-status.ts'

import { apiErrorMessage, readConfig, writeConfig } from './config.ts'

export type ProfileUpdate = { name: string; username: string; avatarURL: string }

export function updateProfile(input: ProfileUpdate) {
  return sendProfileRequest('/auth/me', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export type ProfileCharacter = 'boy' | 'girl'

/** Picks the person's profile character, or clears it with null. */
export function setCharacter(character: ProfileCharacter | null) {
  return sendProfileRequest('/auth/me/character', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ character }),
  })
}

export type ProfileLevel = {
  activeDays: number
  xp: number
  level: number
  levelXp: number
  levelSize: number
}

/** The person's level from the days they used Nuphos, counted in their own time zone. */
export async function readLevel(timeZone: string): Promise<ProfileLevel> {
  const cfg = await readConfig()

  if (!cfg.token) throw new Error('Please sign in again')
  const res = await fetch(`${apiUrl()}/auth/me/level?timeZone=${encodeURIComponent(timeZone)}`, {
    headers: { authorization: `Bearer ${cfg.token}` },
    signal: AbortSignal.timeout(20_000),
  })

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

async function sendProfileRequest(
  path: string,
  init: { method: string; headers?: Record<string, string>; body?: string | Uint8Array },
) {
  const cfg = await readConfig()

  if (!cfg.token) throw new Error('Please sign in again')
  const res = await fetch(`${apiUrl()}${path}`, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${cfg.token}` },
    signal: AbortSignal.timeout(20_000),
  })

  if (!res.ok) throw new Error(await apiErrorMessage(res))
  const user: unknown = await res.json()

  if (!isValidUserInfo(user)) throw new Error('Malformed profile response')
  const current = await readConfig()

  if (current.token !== cfg.token) throw new Error('Your sign-in changed; reopen profile settings')
  await writeConfig({ ...current, user: user.name, username: user.username, userInfo: user })

  return user
}
