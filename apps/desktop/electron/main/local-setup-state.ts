// What "Sync my setup" remembers on this computer, per signed-in member and team:
// the skills and Instructions it put in Nuphos, whether to keep them in sync,
// and file hashes so an unchanged file is never read twice.
import fsSync from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { app } from 'electron'

import { readConfig } from '../auth/config'

import type { SkippedSkill } from './local-setup-plan'

export type LocalSetupResult = {
  at: string
  syncedSkills: number
  uploadedFiles: number
  removedSkills: number
  skipped: SkippedSkill[]
  instruction: 'synced' | 'removed' | 'none' | 'too_long'
  instructionParts: number
  /** Skills whose upload the store refused, e.g. a reserved name. */
  failed: string[]
}

export type LocalSetupStatus = {
  autoSync: boolean
  running: boolean
  localSkills: number
  claudeMdChars: number | null
  last: LocalSetupResult | null
  budget: { files: number; bytes: number }
}

export type TeamState = {
  autoSync: boolean
  /** Per synced skill: relPath → sha256 of the content last uploaded. */
  skills: Record<string, Record<string, string>>
  instructionIds: string[]
  last: LocalSetupResult | null
}

export type FileHash = { size: number; mtimeMs: number; sha256: string }

export type State = {
  teams: Record<string, TeamState>
  /** Absolute path → hash, reused while size and mtime are unchanged. */
  hashes: Record<string, FileHash>
}

export function claudeDir(): string {
  return path.join(os.homedir(), '.claude')
}

function stateFile(): string {
  return path.join(app.getPath('userData'), 'local-setup-sync.json')
}

export function readState(): State {
  try {
    const parsed = JSON.parse(fsSync.readFileSync(stateFile(), 'utf8')) as Partial<State>

    return { teams: parsed.teams ?? {}, hashes: parsed.hashes ?? {} }
  } catch {
    return { teams: {}, hashes: {} }
  }
}

export function writeState(state: State) {
  try {
    fsSync.writeFileSync(stateFile(), JSON.stringify(state), 'utf8')
  } catch (e) {
    console.warn('local-setup: could not save sync state', e)
  }
}

/** Personal stores are per member, so a different sign-in on this computer starts fresh. */
export async function stateKey(teamId: string): Promise<string> {
  const userId = (await readConfig()).userInfo?.id ?? 'unknown'

  return `${userId}:${teamId}`
}

export function teamState(state: State, key: string): TeamState {
  state.teams[key] ??= { autoSync: false, skills: {}, instructionIds: [], last: null }

  return state.teams[key]
}
