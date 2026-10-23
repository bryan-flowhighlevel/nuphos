import assert from 'node:assert/strict'
import test from 'node:test'

import {
  artifactPagePath,
  pickArtifactVersion,
  publishSessionArtifacts,
  readArtifactCall,
  releaseSessionArtifacts,
  readArtifactLine,
  readPickedArtifactVersion,
  subscribeSessionArtifacts,
} from './sessionArtifacts.ts'

import type { ArtifactVersion } from '../components/agent/artifacts/artifactPayload.ts'

const v = (toolCallId: string, version: number, content = toolCallId): ArtifactVersion => ({
  artifactId: 'page',
  title: 'Page',
  kind: 'html',
  content,
  toolCallId,
  version,
})

const view = () => Symbol('view')

test('an unchanged line keeps its array, so readers do not re-render per token', () => {
  const owner = view()
  let notified = 0
  const stop = subscribeSessionArtifacts(() => notified++)

  publishSessionArtifacts(owner, 's1', new Map([['page', [v('a', 1)]]]))
  const first = readArtifactLine('s1', 'page')

  publishSessionArtifacts(owner, 's1', new Map([['page', [v('a', 1)]]]))
  assert.equal(readArtifactLine('s1', 'page'), first)
  assert.equal(notified, 1)
  assert.deepEqual(readArtifactCall('a'), { sessionId: 's1', artifactId: 'page' })
  stop()
  releaseSessionArtifacts(owner, 's1')
})

test('a new version takes over from the one a viewer picked', () => {
  const owner = view()

  publishSessionArtifacts(owner, 's2', new Map([['page', [v('a', 1), v('b', 2)]]]))
  pickArtifactVersion('s2', 'page', 1)
  assert.equal(readPickedArtifactVersion('s2', 'page'), 1)

  publishSessionArtifacts(owner, 's2', new Map([['page', [v('a', 1), v('b', 2), v('c', 3)]]]))
  assert.equal(readPickedArtifactVersion('s2', 'page'), undefined)
  releaseSessionArtifacts(owner, 's2')
})

test('the stored turn renaming its calls keeps the version a viewer picked', () => {
  const owner = view()

  publishSessionArtifacts(owner, 's4', new Map([['page', [v('a', 1), v('nuphos-live', 2)]]]))
  pickArtifactVersion('s4', 'page', 1)
  publishSessionArtifacts(
    owner,
    's4',
    new Map([['page', [v('a', 1), v('runtime-id', 2, 'nuphos-live')]]]),
  )

  assert.equal(readPickedArtifactVersion('s4', 'page'), 1)
  assert.equal(readArtifactCall('nuphos-live'), undefined)
  assert.deepEqual(readArtifactCall('runtime-id'), { sessionId: 's4', artifactId: 'page' })
  releaseSessionArtifacts(owner, 's4')
})

test('a chat is forgotten only when the last view of it leaves the screen', () => {
  const left = view()
  const right = view()

  publishSessionArtifacts(left, 's3', new Map([['page', [v('x', 1)]]]))
  publishSessionArtifacts(right, 's3', new Map([['page', [v('x', 1)]]]))
  releaseSessionArtifacts(left, 's3')
  assert.equal(readArtifactLine('s3', 'page')?.length, 1)

  releaseSessionArtifacts(right, 's3')
  assert.equal(readArtifactLine('s3', 'page'), undefined)
  assert.equal(readArtifactCall('x'), undefined)
})

test('one dock path per artifact', () => {
  assert.equal(artifactPagePath('team1', 'q3-report'), '/teams/team1/artifacts/q3-report')
})
