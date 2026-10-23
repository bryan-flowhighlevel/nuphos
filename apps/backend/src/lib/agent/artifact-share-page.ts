// The public page behind an artifact share link, and the documents its frame
// loads. Pure builders: no config, no network, so markup, escaping and the
// security headers are unit-testable (same split as routes/invite-landing).
//
// The artifact never runs on this origin. The viewer page frames
// `/artifact/<id>/raw`, and that response carries a CSP `sandbox` directive,
// so even opened on its own it gets an opaque origin: no cookies, no storage,
// no reach into the viewer. Only an HTML artifact may run scripts.
import { escapeHtml } from './artifact-share-documents'

import type { ArtifactShare } from './artifact-shares'

type ShareContent = Pick<ArtifactShare, 'shareId' | 'title' | 'kind' | 'language' | 'content'>

const NUPHOS_MARK = `<svg viewBox="22 24 86 78" aria-hidden="true"><path d="M37.1323 73.6672L55.8435 91.9522L49.3132 98.6348L31.1647 80.8997C20.5429 70.5198 20.381 56.4724 31.1046 45.4989C41.4844 34.8771 55.5319 34.7152 66.1537 45.0951L84.3022 62.8302L77.7031 69.5831L58.9918 51.2981C52.4499 44.9052 43.6893 45.1452 37.0902 51.8982C30.6973 58.4401 30.6607 67.343 37.1323 73.6672Z"/><path d="M69.2383 77.3454C75.7098 83.6695 84.6096 83.4279 91.0024 76.886C97.6016 70.1331 97.6397 61.3692 91.0978 54.9763L72.3866 36.6913L78.9857 29.9384L97.1342 47.6734C107.756 58.0533 107.918 72.1007 97.5379 82.7225C86.8144 93.6961 72.7669 93.8579 62.1451 83.478L43.9966 65.7429L50.527 59.0604L69.2383 77.3454Z"/></svg>`

const ICON_COPY = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`
const ICON_CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`
const ICON_DOWNLOAD = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>`

export function artifactKindLabel(share: Pick<ArtifactShare, 'kind' | 'language'>): string {
  if (share.kind === 'html') return 'Page'
  if (share.kind === 'markdown') return 'Document'
  if (share.kind === 'svg') return 'Image'
  if (!share.language) return 'Code'

  return share.language.length <= 3
    ? share.language.toUpperCase()
    : share.language.charAt(0).toUpperCase() + share.language.slice(1)
}

const CODE_EXTENSIONS: Partial<Record<string, string>> = {
  bash: 'sh',
  go: 'go',
  golang: 'go',
  hcl: 'tf',
  javascript: 'js',
  js: 'js',
  jsx: 'jsx',
  python: 'py',
  py: 'py',
  ruby: 'rb',
  rust: 'rs',
  sh: 'sh',
  shell: 'sh',
  terraform: 'tf',
  ts: 'ts',
  tsx: 'tsx',
  typescript: 'ts',
  yaml: 'yaml',
  yml: 'yaml',
}

export function artifactFileName(share: Pick<ArtifactShare, 'title' | 'kind' | 'language'>) {
  const slug =
    share.title
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase()
      .slice(0, 80) || 'artifact'

  if (share.kind === 'html') return `${slug}.html`
  if (share.kind === 'svg') return `${slug}.svg`
  if (share.kind === 'markdown') return `${slug}.md`

  return `${slug}.${CODE_EXTENSIONS[share.language ?? ''] ?? (share.language ? share.language : 'txt')}`
}

/** Headers for the viewer page: its only script is the nonce'd one below. */
export function artifactPageHeaders(nonce: string): Record<string, string> {
  return {
    'Content-Security-Policy': [
      "default-src 'none'",
      "frame-src 'self'",
      "connect-src 'self'",
      'img-src https: data:',
      "style-src 'unsafe-inline'",
      `script-src 'nonce-${nonce}'`,
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join('; '),
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow',
    'Cache-Control': 'no-store',
  }
}

/** Headers for what the frame loads. `sandbox` is what keeps the artifact off this origin. */
export function artifactRawHeaders(kind: ArtifactShare['kind']): Record<string, string> {
  const sandbox =
    kind === 'html'
      ? 'sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals'
      : 'sandbox allow-popups allow-popups-to-escape-sandbox'
  const policy =
    kind === 'html'
      ? [sandbox, "frame-ancestors 'self'"]
      : [
          sandbox,
          "default-src 'none'",
          'img-src https: data:',
          "style-src 'unsafe-inline'",
          "frame-ancestors 'self'",
        ]

  return {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': policy.join('; '),
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow',
    'Cache-Control': 'no-store',
  }
}

/** Headers for the plain source, for Copy and Download. */
export function artifactSourceHeaders(
  share: Pick<ArtifactShare, 'title' | 'kind' | 'language'>,
  download: boolean,
): Record<string, string> {
  return {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Security-Policy': "sandbox; default-src 'none'",
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow',
    'Cache-Control': 'no-store',
    ...(download
      ? { 'Content-Disposition': `attachment; filename="${artifactFileName(share)}"` }
      : {}),
  }
}

const PAGE_STYLE = `
*{box-sizing:border-box}
html,body{height:100%;margin:0}
body{display:flex;flex-direction:column;background:#0f0e11;color:#f4f3f6;font:14px/1.4 Geist,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased}
header{flex:none;display:flex;align-items:center;gap:14px;height:52px;padding:0 10px 0 16px;border-bottom:1px solid rgba(255,255,255,.08)}
.mark{flex:none;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:7px;color:#fff;text-decoration:none}
.mark:hover{background:rgba(255,255,255,.07)}
.mark svg{width:19px;height:19px;fill:currentColor}
.rule{flex:none;width:1px;height:20px;background:rgba(255,255,255,.12)}
.titles{min-width:0;flex:1;display:flex;align-items:baseline;gap:10px}
h1{margin:0;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:14px;font-weight:550;letter-spacing:-.005em}
.meta{flex:none;color:rgba(244,243,246,.52);font-size:12.5px;white-space:nowrap}
.actions{flex:none;display:flex;align-items:center;gap:4px}
.icon{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border:0;border-radius:7px;background:none;color:rgba(244,243,246,.7);cursor:pointer;text-decoration:none}
.icon:hover{background:rgba(255,255,255,.07);color:#fff}
.icon:focus-visible,.cta:focus-visible,.mark:focus-visible{outline:2px solid #a77bff;outline-offset:1px}
.icon svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.icon .done{display:none}
.icon.copied .idle{display:none}
.icon.copied .done{display:block;color:#7ee0a5}
.cta{margin-left:6px;display:inline-flex;align-items:center;height:32px;padding:0 13px;border-radius:7px;background:#7d36ec;box-shadow:inset 0 -2px 0 0 #5621aa;color:#fff;font-size:13px;font-weight:550;text-decoration:none;white-space:nowrap}
.cta:hover{background:#8b46f2}
main{flex:1;min-height:0;position:relative;background:#fff}
iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff;color-scheme:light}
footer{flex:none;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;column-gap:6px;min-height:30px;padding:6px 16px;border-top:1px solid rgba(255,255,255,.08);color:rgba(244,243,246,.45);font-size:11.5px;line-height:1.5;text-align:center}
footer a{color:rgba(244,243,246,.7);text-decoration:none}
footer a:hover{color:#fff}
@media (max-width:640px){.meta,.rule,footer .long{display:none}.cta{padding:0 10px}header{gap:10px}}
`

/** The page a share link opens: Nuphos's frame around the artifact. */
export function artifactSharePage(
  share: ShareContent & Pick<ArtifactShare, 'version'>,
  nonce: string,
): string {
  const title = escapeHtml(share.title)
  const id = escapeHtml(share.shareId)
  // The publisher's name stays off a page anyone can open.
  const meta = escapeHtml(`${artifactKindLabel(share)} · Version ${String(share.version)}`)
  const description = escapeHtml(`${artifactKindLabel(share)} made with an AI agent in Nuphos.`)

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · Nuphos</title>
<meta name="description" content="${description}">
<meta property="og:site_name" content="Nuphos"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="https://nuphos.ai/favicon.svg" type="image/svg+xml">
<style>${PAGE_STYLE}</style></head>
<body>
<header>
  <a class="mark" href="https://nuphos.ai" target="_blank" rel="noopener" aria-label="Nuphos">${NUPHOS_MARK}</a>
  <span class="rule"></span>
  <div class="titles"><h1 title="${title}">${title}</h1><span class="meta">${meta}</span></div>
  <div class="actions">
    <button class="icon" id="copy" type="button" aria-label="Copy source" title="Copy source"><span class="idle">${ICON_COPY}</span><span class="done">${ICON_CHECK}</span></button>
    <a class="icon" href="/artifact/${id}/source?download=1" aria-label="Download" title="Download">${ICON_DOWNLOAD}</a>
    <a class="cta" href="https://nuphos.ai" target="_blank" rel="noopener">Try Nuphos</a>
  </div>
</header>
<main><iframe src="/artifact/${id}/raw" title="${title}" sandbox="${share.kind === 'html' ? 'allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals' : 'allow-popups allow-popups-to-escape-sandbox'}" referrerpolicy="no-referrer"></iframe></main>
<footer><span>Made by an AI agent with <a href="https://nuphos.ai" target="_blank" rel="noopener">Nuphos</a>.</span><span class="long">Nuphos does not check shared content, so don't enter passwords or personal details.</span></footer>
<script nonce="${escapeHtml(nonce)}">
document.getElementById('copy').addEventListener('click',function(){var b=this;fetch('/artifact/${id}/source').then(function(r){return r.text()}).then(function(t){return navigator.clipboard.writeText(t)}).then(function(){b.classList.add('copied');b.setAttribute('aria-label','Copied');setTimeout(function(){b.classList.remove('copied');b.setAttribute('aria-label','Copy source')},1600)}).catch(function(){})})
</script>
</body></html>`
}

export function artifactNotFoundPage(): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Artifact not found · Nuphos</title><link rel="icon" href="https://nuphos.ai/favicon.svg" type="image/svg+xml">
<style>${PAGE_STYLE}
.gone{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:24px;text-align:center}
.gone .mark{width:44px;height:44px;margin-bottom:10px}.gone .mark svg{width:30px;height:30px}
.gone h2{margin:0;font-size:18px;font-weight:600}.gone p{margin:0;color:rgba(244,243,246,.6);max-width:360px;line-height:1.6}
</style></head>
<body><div class="gone"><a class="mark" href="https://nuphos.ai" aria-label="Nuphos">${NUPHOS_MARK}</a><h2>This artifact isn't shared any more</h2><p>Whoever shared it may have unpublished it, or the link is wrong. Ask them for a new link.</p><a class="cta" href="https://nuphos.ai" style="margin-top:14px">Try Nuphos</a></div></body></html>`
}
