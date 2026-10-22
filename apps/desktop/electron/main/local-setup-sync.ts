// "Sync my setup": mirror this computer's Claude Code skills and ~/.claude/CLAUDE.md
// into the signed-in user's personal skills and personal Instructions for a team,
// so every runtime they use starts with the same context their own CLI has. The
// decisions live in local-setup-plan.ts; this module reads disk, calls the API,
// and records what it synced; local-setup-watch.ts re-runs it when files change.
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import {
  createInstruction,
  deleteInstruction,
  listInstructions,
  teamSkillsDeleteObject,
  teamSkillsDeleteSkill,
  teamSkillsListObjects,
  teamSkillsPutObject,
  updateInstruction,
} from '../atlas'

import {
  instructionTitle,
  planSkillSync,
  RUNTIME_BYTE_BUDGET,
  RUNTIME_FILE_BUDGET,
  splitInstruction,
} from './local-setup-plan'
import { claudeDir, readState, stateKey, teamState, writeState } from './local-setup-state'
import { listLocalSkills, localSkillEntries } from './local-skills'

import type { LocalSkillSnapshot, RemoteObject } from './local-setup-plan'
import type {
  FileHash,
  LocalSetupResult,
  LocalSetupStatus,
  State,
  TeamState,
} from './local-setup-state'

export type { LocalSetupResult, LocalSetupStatus } from './local-setup-state'

async function hashFile(
  full: string,
  size: number,
  mtimeMs: number,
  cache: State['hashes'],
  seen: State['hashes'],
) {
  const cached = cache[full] as FileHash | undefined
  const sha256 =
    cached?.size === size && cached.mtimeMs === mtimeMs
      ? cached.sha256
      : createHash('sha256')
          .update(await fs.readFile(full))
          .digest('hex')

  seen[full] = { size, mtimeMs, sha256 }

  return sha256
}

/** Claude Code skills only: Codex keeps its own, and a name can exist under both. */
async function snapshotLocalSkills(
  cache: State['hashes'],
): Promise<{ skills: (LocalSkillSnapshot & { root: string })[]; hashes: State['hashes'] }> {
  const skills = (await listLocalSkills()).filter((skill) => skill.source === 'claude')
  const out: (LocalSkillSnapshot & { root: string })[] = []
  // Only files that still exist keep a cache entry.
  const seen: State['hashes'] = {}

  for (const skill of skills) {
    const entries = await localSkillEntries(skill.path)
    const files = []

    for (const entry of entries) {
      const full = path.join(skill.path, entry.relPath)

      files.push({
        relPath: entry.relPath,
        size: entry.size,
        sha256: await hashFile(full, entry.size, entry.mtimeMs, cache, seen),
      })
    }
    out.push({ name: skill.name, root: skill.path, files })
  }

  return { skills: out, hashes: seen }
}

async function readClaudeMd(): Promise<string | null> {
  return fs.readFile(path.join(claudeDir(), 'CLAUDE.md'), 'utf8').catch(() => null)
}

async function syncInstruction(
  teamId: string,
  team: TeamState,
): Promise<Pick<LocalSetupResult, 'instruction' | 'instructionParts'>> {
  const markdown = (await readClaudeMd())?.trim() ?? ''
  const listing = await listInstructions(teamId)
  const ours = new Set(team.instructionIds)
  const existing = listing.personal.filter((instruction) => ours.has(instruction.id))
  const others = listing.personal.filter((instruction) => !ours.has(instruction.id))
  const { contentChars, snippetsPerScope, totalContentCharsPerScope } = listing.limits
  const parts = markdown ? splitInstruction(markdown, contentChars) : []
  const roomChars =
    totalContentCharsPerScope - others.reduce((sum, item) => sum + item.content.length, 0)
  const fits =
    parts.length + others.length <= snippetsPerScope &&
    parts.reduce((sum, part) => sum + part.length, 0) <= roomChars
  const wanted = fits ? parts : []
  const ids: string[] = []

  // Shrink first, so the scope's total never exceeds its limit mid-pass.
  for (const stale of existing.slice(wanted.length)) await deleteInstruction(teamId, stale.id)
  for (const [index, content] of wanted.entries()) {
    const title = instructionTitle(index, wanted.length)
    const current = existing.at(index)

    if (!current) {
      ids.push((await createInstruction(teamId, { scope: 'personal', title, content })).id)
    } else {
      if (current.title !== title || current.content !== content) {
        await updateInstruction(teamId, current.id, { title, content })
      }
      ids.push(current.id)
    }
  }
  team.instructionIds = ids

  if (!markdown) return { instruction: existing.length ? 'removed' : 'none', instructionParts: 0 }

  return fits
    ? { instruction: 'synced', instructionParts: wanted.length }
    : { instruction: 'too_long', instructionParts: 0 }
}

const running = new Map<string, Promise<LocalSetupResult>>()

async function runSync(teamId: string): Promise<LocalSetupResult> {
  const state = readState()
  const key = await stateKey(teamId)
  const team = teamState(state, key)
  const snapshot = await snapshotLocalSkills(state.hashes)
  const local = snapshot.skills

  state.hashes = snapshot.hashes
  const listing = (await teamSkillsListObjects(teamId, 'personal')) as { objects: RemoteObject[] }
  const plan = planSkillSync(local, team.skills, listing.objects)
  const roots = new Map(local.map((skill) => [skill.name, skill.root]))
  const failed = new Set<string>()

  const removed = new Set<string>()

  for (const name of plan.deleteSkills) {
    // Kept on record when the delete fails, so the next pass retries it.
    await teamSkillsDeleteSkill(teamId, name, 'personal').then(
      () => removed.add(name),
      (e: unknown) => console.warn(`local-setup: could not remove ${name}`, e),
    )
  }
  team.skills = Object.fromEntries(
    Object.entries(team.skills).filter(([name]) => !removed.has(name)),
  )
  for (const objectKey of plan.deleteKeys)
    await teamSkillsDeleteObject(teamId, objectKey, 'personal')

  let uploaded = 0

  // One file in memory at a time, SKILL.md first within each skill (the planner
  // keeps localSkillEntries' order), so a partial pass still leaves listable skills.
  for (const upload of plan.uploads) {
    if (failed.has(upload.name)) continue
    const root = roots.get(upload.name)

    if (!root) continue
    try {
      const bytes = new Uint8Array(await fs.readFile(path.join(root, upload.file.relPath)))

      await teamSkillsPutObject(
        teamId,
        upload.key,
        { filename: upload.file.relPath.split('/').pop() ?? upload.file.relPath, bytes },
        'personal',
      )
      uploaded += 1
      team.skills[upload.name] = {
        ...team.skills[upload.name],
        [upload.file.relPath]: upload.file.sha256,
      }
    } catch (e) {
      console.warn(`local-setup: could not upload ${upload.key}`, e)
      failed.add(upload.name)
    }
  }
  // A synced skill's record is exactly its current files, so deleted ones drop out.
  for (const name of plan.synced) {
    if (failed.has(name)) continue
    const files = local.find((skill) => skill.name === name)?.files ?? []

    team.skills[name] = Object.fromEntries(files.map((file) => [file.relPath, file.sha256]))
  }

  const instruction = await syncInstruction(teamId, team)
  const result: LocalSetupResult = {
    at: new Date().toISOString(),
    syncedSkills: plan.synced.length - failed.size,
    uploadedFiles: uploaded,
    removedSkills: removed.size,
    skipped: plan.skipped,
    failed: [...failed].toSorted((a, b) => a.localeCompare(b)),
    ...instruction,
  }

  team.last = result
  writeState(state)

  return result
}

/** One pass per team at a time; a second request joins the one in flight. */
export function syncLocalSetup(teamId: string): Promise<LocalSetupResult> {
  const inFlight = running.get(teamId)

  if (inFlight) return inFlight
  const pass = runSync(teamId).finally(() => running.delete(teamId))

  running.set(teamId, pass)

  return pass
}

export async function localSetupStatus(teamId: string): Promise<LocalSetupStatus> {
  const state = readState()
  const team = state.teams[await stateKey(teamId)] as TeamState | undefined
  const skills = (await listLocalSkills()).filter((skill) => skill.source === 'claude')

  return {
    autoSync: team?.autoSync ?? false,
    running: running.has(teamId),
    localSkills: skills.length,
    claudeMdChars: (await readClaudeMd())?.trim().length ?? null,
    last: team?.last ?? null,
    budget: { files: RUNTIME_FILE_BUDGET, bytes: RUNTIME_BYTE_BUDGET },
  }
}
