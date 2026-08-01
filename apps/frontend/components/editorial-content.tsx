import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { looksLikeHtml, sanitizeHtml } from "@/lib/content/sanitize-html";
import { cn } from "@/lib/utils";

export function EditorialContent({
  content,
  emptyMessage,
  className,
}: {
  content: string;
  emptyMessage: string;
  className?: string;
}) {
  const body = content.trim();
  const classes = cn("prose-rumera", className);
  const emptyState = (
    <p
      className="rounded-2xl bg-muted/60 p-5 text-muted-foreground"
      role="status"
    >
      {emptyMessage}
    </p>
  );

  if (!body) return emptyState;

  if (looksLikeHtml(body)) {
    const safeContent = sanitizeHtml(body);
    if (!safeContent.trim()) return emptyState;
    return (
      <div
        className={classes}
        dangerouslySetInnerHTML={{ __html: safeContent }}
      />
    );
  }

  return (
    <div className={classes}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h2>{children}</h2>,
          h2: ({ children }) => <h2>{children}</h2>,
          h3: ({ children }) => <h3>{children}</h3>,
          h4: ({ children }) => <h3>{children}</h3>,
          h5: ({ children }) => <h3>{children}</h3>,
          h6: ({ children }) => <h3>{children}</h3>,
          a: ({ href, children }) => {
            const external = typeof href === "string" && /^https?:/i.test(href);
            return (
              <a
                href={href}
                {...(external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
