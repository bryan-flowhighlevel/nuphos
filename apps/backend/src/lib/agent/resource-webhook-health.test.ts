import { beforeEach, expect, test } from 'bun:test'

import { invalidateInstallationToken } from '@/lib/byos/github'
import { useAgentDb } from '@/lib/test/doubles/agent-db'
import { useGithubAppAuth } from '@/lib/test/doubles/github-app-auth'
import { useGithubHttp } from '@/lib/test/doubles/github-http'

import { routeResourceWebhook } from './resource-webhook'

let linked = true
let updates: unknown[][] = []
let requested: string[] = []
let checkConclusion = 'failure'

useAgentDb({
  agentConversations: () =>
    ({
      findOne: async () => (linked ? { _id: 'conversation' } : null),
      updateMany: async (...args: unknown[]) => {
        updates.push(args)

        return { modifiedCount: 1 }
      },
      // No session is woken in these tests.
      find: () => ({ async *[Symbol.asyncIterator] () {} }),
    }),
})
useGithubAppAuth({ generateAppJwt: () => 'test-jwt' })
useGithubHttp({
  githubFetch: async (url) => {
    requested.push(url.replace(/^https:\/\/api\.github\.com/, ''))
    if (url.includes('/access_tokens'))
      return Response.json({ token: 'test-token', expires_at: '2099-01-01T00:00:00Z' })
    if (url.includes('/check-runs'))
      return Response.json({ check_runs: [{ conclusion: 'success' }, { conclusion: checkConclusion }] })
    if (url.endsWith('/status')) return Response.json({ state: 'pending', total_count: 0 })
    if (url.includes('/reviews')) return Response.json([])

    return Response.json({ state: 'open', mergeable_state: 'clean', head: { sha: 'a'.repeat(40) } })
  },
})
beforeEach(() => {
  invalidateInstallationToken(12)
  linked = true
  updates = []
  requested = []
  checkConclusion = 'failure'
})

const suite = (conclusion: string) => ({
  installation: { id: 12 },
  repository: { id: 34, full_name: 'acme/app' },
  action: 'completed',
  check_suite: { status: 'completed', conclusion, pull_requests: [{ number: 56 }] },
})
const healthUpdate = (health: string | null) => [
  { 'linkedResources.key': 'github/12/34/56' },
  { $set: { 'linkedResources.$[resource].health': health } },
  { arrayFilters: [{ 'resource.key': 'github/12/34/56' }] },
]

test('a failed CI run turns a linked PR tag red', async () => {
  await routeResourceWebhook('check_suite', suite('failure'), 'delivery-1')
  expect(updates).toEqual([healthUpdate('checks_failed')])
  expect(requested).toContain('/repos/acme/app/pulls/56')
  expect(requested).toContain(`/repos/acme/app/commits/${'a'.repeat(40)}/check-runs?filter=latest&per_page=100`)
})

test('a green re-run clears it', async () => {
  checkConclusion = 'success'
  await routeResourceWebhook('check_suite', suite('success'), 'delivery-2')
  expect(updates).toEqual([healthUpdate(null)])
})

test('a PR nobody linked costs no GitHub lookups', async () => {
  linked = false
  await routeResourceWebhook('check_suite', suite('failure'), 'delivery-3')
  expect(updates).toEqual([])
  expect(requested).toEqual([])
})

test('a merge stores the state and drops any stale health', async () => {
  await routeResourceWebhook(
    'pull_request',
    {
      installation: { id: 12 },
      repository: { id: 34, full_name: 'acme/app' },
      action: 'closed',
      pull_request: { number: 56, state: 'closed', merged: true },
    },
    'delivery-4',
  )
  expect(updates).toEqual([
    [
      { 'linkedResources.key': 'github/12/34/56' },
      {
        $set: {
          'linkedResources.$[resource].state': 'merged',
          'linkedResources.$[resource].health': null,
        },
      },
      { arrayFilters: [{ 'resource.key': 'github/12/34/56' }] },
    ],
  ])
})
