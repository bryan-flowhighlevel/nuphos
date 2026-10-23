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

// The frame around an artifact, on every screen it can open on: phones with a
// notch or Dynamic Island and a home indicator (safe-area insets, viewport-fit
// cover), touch screens (44px targets), and foldables. On a fold the browser
// reports two viewport segments; the artifact runs in an iframe, where segments
// are not exposed, so this page keeps it off the crease: the artifact takes one
// segment and the details take the other.
const PAGE_STYLE = `
*{box-sizing:border-box}
html{height:100%;-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;height:100%;height:100dvh;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr) auto;grid-template-areas:"header" "stage" "footer";background:#0f0e11;color:#f4f3f6;font:14px/1.4 Geist,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}
header{grid-area:header;display:flex;align-items:center;gap:12px;min-height:52px;padding:env(safe-area-inset-top) max(8px,env(safe-area-inset-right)) 0 max(12px,env(safe-area-inset-left));border-bottom:1px solid rgba(255,255,255,.08)}
.mark{flex:none;display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;color:#fff;text-decoration:none}
.mark:hover{background:rgba(255,255,255,.07)}
.mark svg{width:19px;height:19px;fill:currentColor}
.rule{flex:none;width:1px;height:20px;background:rgba(255,255,255,.12)}
.titles{min-width:0;flex:1;display:flex;align-items:baseline;gap:10px}
h1{margin:0;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:14px;font-weight:550;letter-spacing:-.005em}
.meta{flex:none;color:rgba(244,243,246,.52);font-size:12.5px;white-space:nowrap}
.actions{flex:none;display:flex;align-items:center;gap:2px}
.icon{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-width:36px;height:36px;padding:0;border:0;border-radius:8px;background:none;color:rgba(244,243,246,.72);font:inherit;font-size:13.5px;cursor:pointer;text-decoration:none}
.icon:hover{background:rgba(255,255,255,.07);color:#fff}
.icon:focus-visible,.cta:focus-visible,.mark:focus-visible{outline:2px solid #a77bff;outline-offset:1px}
.icon svg{flex:none;width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.icon .label{display:none}
.icon .done{display:none}
.icon.done .idle{display:none}
.icon.done .done{display:block;color:#7ee0a5}
.cta{flex:none;margin-left:6px;display:inline-flex;align-items:center;justify-content:center;height:36px;padding:0 14px;border-radius:8px;background:#7d36ec;box-shadow:inset 0 -2px 0 0 #5621aa;color:#fff;font-size:13.5px;font-weight:550;text-decoration:none;white-space:nowrap}
.cta:hover{background:#8b46f2}
main{grid-area:stage;position:relative;min-height:0;margin:0 env(safe-area-inset-right) 0 env(safe-area-inset-left);background:#fff}
/* width:1px + min-width:100%: iOS Safari otherwise widens an iframe to its content. */
iframe{position:absolute;top:0;left:0;width:1px;min-width:100%;height:100%;border:0;background:#fff;color-scheme:light}
footer{grid-area:footer;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;column-gap:6px;row-gap:8px;min-height:30px;padding:6px max(16px,env(safe-area-inset-right)) max(6px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));border-top:1px solid rgba(255,255,255,.08);color:rgba(244,243,246,.45);font-size:11.5px;line-height:1.5;text-align:center}
footer a{color:rgba(244,243,246,.7);text-decoration:none}
footer a:hover{color:#fff}
footer .cta{display:none}
@media (pointer:coarse){.mark,.icon{min-width:44px;height:44px}.cta{height:44px}header{min-height:60px}}
@media (max-width:560px){
  .rule,footer .long{display:none}
  .titles{flex-direction:column;align-items:stretch;gap:1px}
  h1{max-width:100%}
  .meta{font-size:12px}
  header .cta{display:none}
  footer{padding-top:8px}
  footer .cta{display:inline-flex;margin:0 0 0 10px;height:36px}
}
@media (max-width:360px){#copy{display:none}header{gap:8px}}
/* Two segments side by side (a fold running top to bottom): details left, artifact right. */
@media (horizontal-viewport-segments:2){
  body{grid-template-columns:env(viewport-segment-width 0 0,50%) calc(env(viewport-segment-left 1 0,50%) - env(viewport-segment-right 0 0,50%)) env(viewport-segment-width 1 0,50%);grid-template-rows:minmax(0,1fr) auto;grid-template-areas:"header . stage" "footer . stage"}
  main{margin:0 env(safe-area-inset-right) 0 0}
}
/* Two segments stacked (a fold running left to right): artifact on top, details below. */
@media (vertical-viewport-segments:2){
  body{grid-template-rows:env(viewport-segment-height 0 0,50%) calc(env(viewport-segment-top 0 1,50%) - env(viewport-segment-bottom 0 0,50%)) minmax(0,1fr) auto;grid-template-areas:"stage" "." "header" "footer"}
  main{margin-top:env(safe-area-inset-top)}
}
@media (horizontal-viewport-segments:2),(vertical-viewport-segments:2){
  header{flex-direction:column;align-items:stretch;justify-content:flex-start;gap:16px;padding:max(24px,env(safe-area-inset-top)) 24px 16px max(24px,env(safe-area-inset-left));border-bottom:0;overflow-y:auto}
  .rule{display:none}
  .titles{flex:none;flex-direction:column;align-items:flex-start;gap:4px}
  h1{white-space:normal;font-size:20px;line-height:1.25;letter-spacing:-.012em}
  .meta{display:block;font-size:13px}
  .actions{flex-direction:column;align-items:stretch;gap:4px}
  .icon{justify-content:flex-start;width:100%;padding:0 12px;background:rgba(255,255,255,.05)}
  .icon .label{display:inline}
  #copy{display:inline-flex}
  header .cta{display:inline-flex;margin:8px 0 0}
  footer{justify-content:flex-start;text-align:left;border-top:0;padding:0 24px max(16px,env(safe-area-inset-bottom)) max(24px,env(safe-area-inset-left))}
  footer .long{display:inline}
  footer .cta{display:none}
}
@media (vertical-viewport-segments:2){header{flex-direction:row;flex-wrap:wrap;align-items:flex-start}.titles{flex:1 1 240px}.actions{flex:1 1 240px}}
`

const ICON_SHARE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>`

// Share opens the system share sheet where there is one, and copies the link
// where there isn't. Copy fetches the source, which the frame cannot hand over.
function pageScript(id: string): string {
  return `
function flash(b,label,restore){b.classList.add('done');b.setAttribute('aria-label',label);setTimeout(function(){b.classList.remove('done');b.setAttribute('aria-label',restore)},1600)}
document.getElementById('share').addEventListener('click',function(){var b=this,data={title:document.title,url:location.href};
if(navigator.share){navigator.share(data).catch(function(){});return}
navigator.clipboard.writeText(location.href).then(function(){flash(b,'Link copied','Share')}).catch(function(){})});
document.getElementById('copy').addEventListener('click',function(){var b=this;fetch('/artifact/${id}/source').then(function(r){return r.text()}).then(function(t){return navigator.clipboard.writeText(t)}).then(function(){flash(b,'Copied','Copy source')}).catch(function(){})});
`
}

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
  const sandbox =
    share.kind === 'html'
      ? 'allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals'
      : 'allow-popups allow-popups-to-escape-sandbox'
  const cta =
    '<a class="cta" href="https://nuphos.ai" target="_blank" rel="noopener">Try Nuphos</a>'

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0f0e11"><meta name="color-scheme" content="dark">
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
    <button class="icon" id="share" type="button" aria-label="Share" title="Share"><span class="idle">${ICON_SHARE}</span><span class="done">${ICON_CHECK}</span><span class="label">Share link</span></button>
    <button class="icon" id="copy" type="button" aria-label="Copy source" title="Copy source"><span class="idle">${ICON_COPY}</span><span class="done">${ICON_CHECK}</span><span class="label">Copy source</span></button>
    <a class="icon" href="/artifact/${id}/source?download=1" aria-label="Download" title="Download">${ICON_DOWNLOAD}<span class="label">Download</span></a>
    ${cta}
  </div>
</header>
<main><iframe src="/artifact/${id}/raw" title="${title}" sandbox="${sandbox}" referrerpolicy="no-referrer"></iframe></main>
<footer><span>Made by an AI agent with <a href="https://nuphos.ai" target="_blank" rel="noopener">Nuphos</a>.</span><span class="long">Nuphos does not check shared content, so don't enter passwords or personal details.</span>${cta}</footer>
<script nonce="${escapeHtml(nonce)}">${pageScript(id)}</script>
</body></html>`
}

export function artifactNotFoundPage(): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Artifact not found · Nuphos</title><link rel="icon" href="https://nuphos.ai/favicon.svg" type="image/svg+xml">
<style>${PAGE_STYLE}
.gone{grid-row:1/-1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:24px;text-align:center}
.gone .mark{width:44px;height:44px;margin-bottom:10px}.gone .mark svg{width:30px;height:30px}
.gone h2{margin:0;font-size:18px;font-weight:600}.gone p{margin:0;color:rgba(244,243,246,.6);max-width:360px;line-height:1.6}
</style></head>
<body><div class="gone"><a class="mark" href="https://nuphos.ai" aria-label="Nuphos">${NUPHOS_MARK}</a><h2>This artifact isn't shared any more</h2><p>Whoever shared it may have unpublished it, or the link is wrong. Ask them for a new link.</p><a class="cta" href="https://nuphos.ai" style="margin-top:14px">Try Nuphos</a></div></body></html>`
}
