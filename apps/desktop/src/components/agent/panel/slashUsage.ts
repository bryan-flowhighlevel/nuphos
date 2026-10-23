// How often each agent command has been used from this computer, so the `/`
// menu can offer the user's own favourites first.

const KEY = 'nuphos.slashCommandUsage.v1'

export type SlashUsage = Readonly<Record<string, number>>

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function readSlashUsage(store: Storage | null = storage()): SlashUsage {
  try {
    const parsed: unknown = JSON.parse(store?.getItem(KEY) ?? '{}')

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === 'number' && Number.isFinite(entry[1]),
      ),
    )
  } catch {
    return {}
  }
}

/** Counts one use of each name and returns the new totals. */
export function recordSlashUse(
  names: readonly string[],
  store: Storage | null = storage(),
): SlashUsage {
  const usage = { ...readSlashUsage(store) }

  for (const name of new Set(names)) usage[name] = (usage[name] ?? 0) + 1
  try {
    store?.setItem(KEY, JSON.stringify(usage))
  } catch {
    // Full or blocked storage only costs the ordering.
  }

  return usage
}

/** The known commands a sent message uses, as `/name` at the start or after a space. */
export function slashCommandsIn(text: string, known: ReadonlySet<string>): string[] {
  return [...text.matchAll(/(?:^|\s)\/([^\s/]+)/g)]
    .map((match) => match[1])
    .filter((name) => known.has(name))
}
