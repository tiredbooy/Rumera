import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { sanitizeHtml, looksLikeHtml } from "@/lib/journal/sanitize-html"

/**
 * ArticleBody — renders a journal article's content inside `.prose-rumera`.
 *
 * Blog content is authored as HTML, so when it carries markup we sanitize it to
 * a strict allowlist (see `sanitizeHtml`) and render it via
 * `dangerouslySetInnerHTML`. Older/plain bodies fall back to Markdown rendering.
 * Either way the typography comes from `.prose-rumera`, so the two paths look
 * identical. A11y: external links get `rel="noopener"` hardening at the link
 * level (markdown path) and the sanitizer keeps only safe URL schemes (HTML
 * path).
 */
export function ArticleBody({ content }: { content: string }) {
  const body = content?.trim() ?? ""

  if (!body) return null

  if (looksLikeHtml(body)) {
    const safe = sanitizeHtml(body)
    return (
      <div
        className="prose-rumera"
        // Content is sanitized to a strict tag/attr allowlist above.
        dangerouslySetInnerHTML={{ __html: safe }}
      />
    )
  }

  return (
    <div className="prose-rumera">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => {
            const external = typeof href === "string" && /^https?:/i.test(href)
            return (
              <a
                href={href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                {...props}
              >
                {children}
              </a>
            )
          },
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  )
}
