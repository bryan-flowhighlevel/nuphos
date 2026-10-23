import { describe, expect, test } from 'bun:test'

import { artifactRawDocument, htmlArtifactDocument } from './artifact-share-documents'
import {
  artifactFileName,
  artifactPageHeaders,
  artifactRawHeaders,
  artifactSharePage,
  artifactSourceHeaders,
} from './artifact-share-page'
import { newShareId } from './artifact-shares'

const share = {
  shareId: 'AbCdEfGhIjKlMnOpQrStUv',
  title: 'Q3 <review> & "notes"',
  kind: 'markdown' as const,
  content: '# Hi',
  version: 3,
}

describe('artifact share page', () => {
  test('escapes the title and frames the raw document with a matching sandbox', () => {
    const page = artifactSharePage(share, 'n0nce')

    expect(page).toContain('Q3 &lt;review&gt; &amp; &quot;notes&quot;')
    expect(page).not.toContain('<review>')
    expect(page).toContain('src="/artifact/AbCdEfGhIjKlMnOpQrStUv/raw"')
    expect(page).toContain('sandbox="allow-popups allow-popups-to-escape-sandbox"')
    expect(page).toContain('<script nonce="n0nce">')
    expect(page).toContain('Document · Version 3')
  })

  test('the viewer runs only its own script and cannot be framed', () => {
    const csp = artifactPageHeaders('n0nce')['Content-Security-Policy'] ?? ''

    expect(csp).toContain("script-src 'nonce-n0nce'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("frame-src 'self'")
  })

  test('only an HTML artifact may run scripts, and none gets this origin', () => {
    for (const kind of ['html', 'markdown', 'svg', 'code'] as const) {
      const csp = artifactRawHeaders(kind)['Content-Security-Policy'] ?? ''

      expect(csp.startsWith('sandbox')).toBe(true)
      expect(csp).not.toContain('allow-same-origin')
      expect(csp.includes('allow-scripts')).toBe(kind === 'html')
    }
  })

  test('Markdown renders as a page, and raw HTML in it cannot run', () => {
    const doc = artifactRawDocument({
      ...share,
      content: '# Title\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n<script>alert(1)</script>',
    })

    expect(doc).toContain('<h1>Title</h1>')
    expect(doc).toContain('<table>')
    expect(artifactRawHeaders('markdown')['Content-Security-Policy']).not.toContain('script')
  })

  test('code is escaped line by line, and an SVG is drawn as an image', () => {
    const code = artifactRawDocument({
      ...share,
      kind: 'code',
      content: 'if a < b:\n  print("<x>")',
    })

    expect(code).toContain('<span>if a &lt; b:</span>')
    expect(code).not.toContain('<x>')
    const svg = artifactRawDocument({
      ...share,
      kind: 'svg',
      content: '<svg><script>x</script></svg>',
    })

    expect(svg).toContain('<img src="data:image/svg+xml;base64,')
    expect(svg).not.toContain('<script>x</script>')
  })

  test('links in an HTML artifact open a new tab, and the bootstrap lands in its head', () => {
    const doc = htmlArtifactDocument('<!-- <head> --><!doctype html><html><head><title>T</title>')

    expect(doc.indexOf('<head>')).toBeLessThan(doc.indexOf('<base target="_blank">'))
    expect(doc.indexOf('<base')).toBeLessThan(doc.indexOf('<title>'))
  })

  test('an HTML artifact gets a viewport only when it brought none, and defaults it can override', () => {
    const bare = htmlArtifactDocument('<!doctype html><html><head><title>T</title></head></html>')
    const own = htmlArtifactDocument(
      '<!doctype html><html><head><meta name="viewport" content="width=600"></head></html>',
    )

    expect(bare).toContain(
      '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
    )
    expect(own).not.toContain('viewport-fit=cover')
    expect(own).toContain('content="width=600"')
    // Zero-specificity defaults: any rule the artifact writes wins.
    expect(bare).toContain(':where(img,video,canvas){max-width:100%;height:auto}')
  })

  test('the viewer fits phones, touch and foldables', () => {
    const page = artifactSharePage(share, 'n0nce')

    expect(page).toContain('viewport-fit=cover')
    expect(page).toContain('env(safe-area-inset-bottom)')
    expect(page).toContain('@media (pointer:coarse){.mark,.icon{min-width:44px;height:44px}')
    expect(page).toContain('@media (horizontal-viewport-segments:2)')
    expect(page).toContain('@media (vertical-viewport-segments:2)')
    expect(page).toContain('env(viewport-segment-width 0 0,50%)')
    expect(page).toContain('navigator.share')
    expect(page).toContain('id="share"')
  })

  test('downloads are named after the title', () => {
    expect(artifactFileName({ title: 'Q3 Review!', kind: 'markdown' })).toBe('q3-review.md')
    expect(artifactFileName({ title: 'Idle', kind: 'code', language: 'python' })).toBe('idle.py')
    expect(artifactSourceHeaders({ title: 'Idle', kind: 'svg' }, true)['Content-Disposition']).toBe(
      'attachment; filename="idle.svg"',
    )
  })

  test('share ids are 22 random base62 characters', () => {
    const ids = new Set(Array.from({ length: 200 }, newShareId))

    expect(ids.size).toBe(200)
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9]{22}$/)
  })
})
