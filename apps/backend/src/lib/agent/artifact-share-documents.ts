// The documents a share page's frame loads, one per artifact kind. Each is
// served with a CSP sandbox (see artifactRawHeaders), so nothing here runs on
// the API origin.
import { Marked } from 'marked'

import type { ArtifactShare } from './artifact-shares'

type ShareContent = Pick<ArtifactShare, 'title' | 'kind' | 'content'>

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

// Links leave the frame for a new tab; in-page anchors still move the hash.
const LINK_BOOT = `<base target="_blank"><script>document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;if(!a)return;var h=a.getAttribute('href')||'';if(h.charAt(0)==='#'){e.preventDefault();location.hash=h}else if(/^javascript:/i.test(h)){e.preventDefault()}},true)</script>`

const GAP = '(?:\\s|<!--[\\s\\S]*?-->)*'
const PROLOGUE = new RegExp(
  `^${GAP}(<!doctype[^>]*>)?${GAP}(<html(?:\\s[^>]*)?>)?${GAP}(<head(?:\\s[^>]*)?>)?`,
  'i',
)

/** An HTML artifact with the link handling ahead of anything it loads. */
export function htmlArtifactDocument(html: string): string {
  const [opening = '', doctype, openHtml, openHead] = PROLOGUE.exec(html) ?? []
  const rest = html.slice(opening.length)

  if (openHead) return `${opening}${LINK_BOOT}${rest}`
  if (openHtml || doctype) return `${opening}<head>${LINK_BOOT}</head>${rest}`

  return `<!doctype html><html><head><meta charset="utf-8">${LINK_BOOT}</head><body>${html}</body></html>`
}

const DOCUMENT_STYLE = `
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:#fff;color:#1f1d24;font:16px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
main{max-width:720px;margin:0 auto;padding:56px 28px 96px}
h1,h2,h3,h4{line-height:1.25;letter-spacing:-.012em;color:#121016;margin:2em 0 .6em}
h1{font-size:34px;margin-top:0;letter-spacing:-.02em}
h2{font-size:24px}
h3{font-size:19px}
p,ul,ol,blockquote,table,pre{margin:0 0 1.1em}
a{color:#6d2ee0;text-underline-offset:2px}
img{max-width:100%}
hr{border:0;border-top:1px solid #e7e5ea;margin:2.4em 0}
blockquote{border-left:3px solid #d9d3e8;padding:.1em 0 .1em 1em;color:#5b5766}
code{font:13.5px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#f3f2f6;border-radius:5px;padding:.15em .4em}
pre{background:#f6f5f9;border:1px solid #ebe9f0;border-radius:10px;padding:14px 16px;overflow:auto}
pre code{background:none;padding:0}
table{border-collapse:collapse;width:100%;font-size:15px}
th,td{border-bottom:1px solid #ebe9f0;padding:9px 12px;text-align:left}
th{font-weight:600;color:#121016;background:#faf9fc}
`

const marked = new Marked({ gfm: true })

function documentShell(title: string, style: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank"><title>${escapeHtml(title)}</title><style>${style}</style></head><body>${body}</body></html>`
}

/** A Markdown artifact as a reading page. Raw HTML in it renders, but cannot run. */
export function markdownArtifactDocument(title: string, markdown: string): string {
  return documentShell(
    title,
    DOCUMENT_STYLE,
    `<main>${marked.parse(markdown, { async: false })}</main>`,
  )
}

const CODE_STYLE = `
body{margin:0;background:#fbfbfd;color:#1f1d24}
pre{margin:0;padding:20px 0 64px;font:13.5px/1.7 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;counter-reset:line;overflow:auto}
pre span{display:block;padding:0 24px 0 0;white-space:pre}
pre span::before{counter-increment:line;content:counter(line);display:inline-block;width:56px;padding-right:20px;text-align:right;color:#a7a3b2;user-select:none}
`

/** A code artifact with line numbers. */
export function codeArtifactDocument(title: string, code: string): string {
  const lines = code
    .replace(/\n$/, '')
    .split('\n')
    .map((line) => `<span>${escapeHtml(line) || ' '}</span>`)
    .join('')

  return documentShell(title, CODE_STYLE, `<pre>${lines}</pre>`)
}

/** An SVG artifact drawn as an image, so its own scripts never run. */
export function svgArtifactDocument(title: string, svg: string): string {
  const src = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`

  return documentShell(
    title,
    'html,body{height:100%;margin:0;background:#fff}body{display:flex;align-items:center;justify-content:center;padding:48px;box-sizing:border-box}img{max-width:100%;max-height:100%}',
    `<img src="${src}" alt="${escapeHtml(title)}">`,
  )
}

export function artifactRawDocument(share: ShareContent): string {
  if (share.kind === 'html') return htmlArtifactDocument(share.content)
  if (share.kind === 'markdown') return markdownArtifactDocument(share.title, share.content)
  if (share.kind === 'svg') return svgArtifactDocument(share.title, share.content)

  return codeArtifactDocument(share.title, share.content)
}
