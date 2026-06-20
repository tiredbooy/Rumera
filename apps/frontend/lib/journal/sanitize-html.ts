/**
 * Dependency-free, server-safe HTML sanitizer for journal article bodies.
 *
 * The blog API stores article content as HTML (`<p>…</p>`, `<h2>`, lists, links,
 * images, blockquotes). We render it inside `.prose-rumera`, but raw HTML from a
 * CMS must never be trusted blindly, so this strips everything except a small,
 * known-safe allowlist of tags and attributes — no `<script>`, no inline event
 * handlers, no `javascript:` URLs, no `<iframe>`/`<style>`.
 *
 * It runs in any runtime (no DOM / no jsdom dependency), so it's safe to call in
 * a React Server Component. The output is intended for `dangerouslySetInnerHTML`
 * only after passing through here.
 */

// Tags we keep. Everything else is unwrapped (its text content survives) or, for
// dangerous containers, dropped wholesale.
const ALLOWED_TAGS = new Set([
  "p", "br", "hr",
  "h2", "h3", "h4",
  "strong", "b", "em", "i", "u", "s", "mark", "small", "sub", "sup",
  "ul", "ol", "li",
  "blockquote", "figure", "figcaption",
  "a", "img",
  "table", "thead", "tbody", "tr", "th", "td",
  "code", "pre", "span", "div",
])

// Containers whose *entire contents* must be discarded (not just unwrapped).
const DROP_WITH_CONTENT = new Set(["script", "style", "iframe", "object", "embed", "noscript"])

// Per-tag attribute allowlist.
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title"]),
  img: new Set(["src", "alt", "title", "width", "height"]),
}

const SAFE_URL = /^(https?:|mailto:|tel:|\/|#)/i

function isSafeUrl(value: string): boolean {
  const v = value.trim()
  // Block javascript:, data:, vbscript: and other non-allowlisted schemes.
  return SAFE_URL.test(v)
}

function sanitizeAttrs(tag: string, raw: string): string {
  const allowed = ALLOWED_ATTRS[tag]
  if (!allowed) return ""
  const out: string[] = []
  const attrRe = /([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g
  let m: RegExpExecArray | null
  while ((m = attrRe.exec(raw)) !== null) {
    const name = m[1].toLowerCase()
    if (!allowed.has(name)) continue
    const value = m[3] ?? m[4] ?? m[5] ?? ""
    if ((name === "href" || name === "src") && !isSafeUrl(value)) continue
    // Escape any stray quotes so the attribute can't break out.
    const safeValue = value.replace(/"/g, "&quot;")
    out.push(`${name}="${safeValue}"`)
  }
  // External links get hardened rel/target on render (added in renderer), so we
  // don't emit target here.
  return out.length ? " " + out.join(" ") : ""
}

/**
 * Sanitize an HTML string down to the allowlist above. Returns safe HTML ready
 * for `dangerouslySetInnerHTML`. Self-closing voids (`br`, `hr`, `img`) are
 * normalized; disallowed tags are unwrapped; dangerous containers are removed
 * with their content.
 */
export function sanitizeHtml(input: string): string {
  if (!input) return ""

  let html = input
  // 1. Remove dangerous containers (script/style/iframe…) and everything inside.
  for (const tag of DROP_WITH_CONTENT) {
    const re = new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, "gi")
    html = html.replace(re, "")
    // Unclosed dangerous tags → strip from the open tag to the end.
    html = html.replace(new RegExp(`<${tag}[\\s\\S]*$`, "gi"), "")
  }
  // 2. Strip HTML comments (can hide conditional/IE payloads).
  html = html.replace(/<!--[\s\S]*?-->/g, "")

  const VOID = new Set(["br", "hr", "img"])

  // 3. Walk every tag and rebuild it from the allowlist.
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (match, rawName, rawAttrs) => {
    const name = String(rawName).toLowerCase()
    const closing = match.startsWith("</")

    if (!ALLOWED_TAGS.has(name)) {
      // Unwrap unknown tags — drop the tag, keep inner text.
      return ""
    }

    if (closing) {
      return VOID.has(name) ? "" : `</${name}>`
    }

    const attrs = sanitizeAttrs(name, String(rawAttrs))
    if (VOID.has(name)) return `<${name}${attrs} />`
    return `<${name}${attrs}>`
  })
}

/** True when a string looks like it carries HTML markup (vs plain text/markdown). */
export function looksLikeHtml(input: string): boolean {
  return /<\/?[a-zA-Z][\s\S]*>/.test(input)
}
