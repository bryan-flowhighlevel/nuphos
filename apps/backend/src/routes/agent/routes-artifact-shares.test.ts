import { beforeEach, describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import { ObjectId } from 'mongodb'

import { errorHandler } from '@/lib/errors'
import { useAgentDb } from '@/lib/test/doubles/agent-db'
import { useDb } from '@/lib/test/doubles/db'
import { useIdentity } from '@/lib/test/doubles/identity'
import { portabilityDb } from '@/lib/test/runtime-portability-db'

import type { AgentConversation } from '@/lib/agent/db'
import type * as dbActual from '@/lib/db'
import type { AuthVariables } from '@/middleware/auth'

const TEAM = new ObjectId().toHexString()
const MEMBER = 'member-user'
const OUTSIDER = 'outsider-user'

let viewer = MEMBER
let memory = portabilityDb()

useDb({ db: (() => memory) as unknown as typeof dbActual.db })
useAgentDb({
  getReadableConversation: async (sessionId, viewerUserId, teamId) =>
    sessionId === 'chat' && teamId === TEAM && viewerUserId === MEMBER
      ? ({ sessionId, teamId, userId: MEMBER } as AgentConversation)
      : null,
})
useIdentity({
  getTeamMembership: async (userId, teamId) =>
    teamId === TEAM && userId === MEMBER ? ({ role: 'MEMBER' } as never) : null,
})

const { artifactShareRoutes } = await import('./routes-artifact-shares')
const { artifactPublicRoutes } = await import('../artifact-public')
const app = new Hono<{ Variables: AuthVariables }>()

app.use('*', async (c, next) => {
  c.set('userId', viewer)
  c.set('userName', 'Member Name')
  if (c.req.header('X-Test-Runtime')) c.set('previewConversationOwnerUserId', MEMBER)
  await next()
})
app.route('/agent', artifactShareRoutes)
app.route('/artifact', artifactPublicRoutes)
app.onError(errorHandler)

const SHARE = `/agent/conversations/chat/artifacts/spend-page/share?teamId=${TEAM}`
const page = '<!doctype html><html><head><title>x</title></head><body><h1>Spend</h1></body></html>'

function publish(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return app.request(SHARE, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ version: 1, title: 'Spend', kind: 'html', content: page, ...body }),
  })
}

type ShareBody = { share: { shareId: string; url: string; version: number } | null }

beforeEach(() => {
  viewer = MEMBER
  memory = portabilityDb()
})

describe('artifact share links', () => {
  test('publishing makes a link anyone can open, and unpublishing takes it down', async () => {
    const none = (await (await app.request(SHARE)).json()) as ShareBody

    expect(none.share).toBeNull()
    const published = (await (await publish({})).json()) as ShareBody
    const shareId = published.share?.shareId ?? ''

    expect(shareId).toMatch(/^[A-Za-z0-9]{22}$/)
    expect(published.share?.url.endsWith(`/artifact/${shareId}`)).toBe(true)

    const viewerPage = await app.request(`/artifact/${shareId}`)

    expect(viewerPage.status).toBe(200)
    expect(await viewerPage.text()).toContain(`src="/artifact/${shareId}/raw"`)
    const raw = await app.request(`/artifact/${shareId}/raw`)

    expect(raw.headers.get('Content-Security-Policy')).toContain('sandbox allow-scripts')
    expect(raw.headers.get('Content-Security-Policy')).not.toContain('allow-same-origin')
    expect(await raw.text()).toContain('<h1>Spend</h1>')

    await app.request(SHARE, { method: 'DELETE' })
    expect((await app.request(`/artifact/${shareId}`)).status).toBe(404)
    expect((await app.request(`/artifact/${shareId}/raw`)).status).toBe(404)
  })

  test('publishing another version keeps the link and changes what it shows', async () => {
    const first = (await (await publish({})).json()) as ShareBody
    const second = (await (
      await publish({ version: 2, content: page.replace('Spend', 'Spend v2') })
    ).json()) as ShareBody

    expect(second.share?.shareId).toBe(first.share?.shareId ?? '')
    expect(second.share?.version).toBe(2)
    const raw = await app.request(`/artifact/${second.share?.shareId ?? ''}/raw`)

    expect(await raw.text()).toContain('Spend v2')
  })

  test('only someone who can read the conversation can see or publish its links', async () => {
    viewer = OUTSIDER
    // Not a member: the team does not resolve, the same answer every team route gives.
    expect((await app.request(SHARE)).status).toBe(400)
    expect((await publish({})).status).toBe(400)
    expect(memory.rows('agent_artifact_shares')).toHaveLength(0)
  })

  test('an agent or runtime token cannot publish to the web', async () => {
    const response = await publish({}, { 'X-Test-Runtime': '1' })

    expect(response.status).toBe(403)
    expect(memory.rows('agent_artifact_shares')).toHaveLength(0)
  })

  test('rejects content the tool itself would refuse', async () => {
    expect((await publish({ kind: 'react' })).status).toBe(400)
    expect((await publish({ content: '' })).status).toBe(400)
    expect((await publish({ extra: true })).status).toBe(400)
  })

  test('an unknown or malformed link is a not-found page, never an error', async () => {
    expect((await app.request('/artifact/nope')).status).toBe(404)
    expect((await app.request('/artifact/AAAAAAAAAAAAAAAAAAAAAA')).status).toBe(404)
  })
})
