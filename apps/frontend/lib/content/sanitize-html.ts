const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "mark",
  "small",
  "sub",
  "sup",
  "ul",
  "ol",
  "li",
  "blockquote",
  "figure",
  "figcaption",
  "a",
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "code",
  "pre",
  "span",
  "div",
]);

const DROP_WITH_CONTENT = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "noscript",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title"]),
  img: new Set(["src", "alt", "title", "width", "height"]),
};

const SAFE_URL = /^(https?:|mailto:|tel:|\/|#)/i;
const HTML_DOCUMENT_START = new RegExp(
  `^\\s*(?:<!--[\\s\\S]*?-->\\s*)*<\\/?(?:${Array.from(new Set([...ALLOWED_TAGS, ...DROP_WITH_CONTENT])).join("|")})(?:\\s|/?>)`,
  "i",
);

function isSafeUrl(value: string): boolean {
  return SAFE_URL.test(value.trim());
}

function sanitizeAttrs(tag: string, raw: string): string {
  const allowed = ALLOWED_ATTRS[tag];
  if (!allowed) return "";
  const out: string[] = [];
  const seen = new Set<string>();
  const attrRe =
    /([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let match: RegExpExecArray | null;
  while ((match = attrRe.exec(raw)) !== null) {
    const name = match[1].toLowerCase();
    if (!allowed.has(name)) continue;
    seen.add(name);
    const value = match[3] ?? match[4] ?? match[5] ?? "";
    if ((name === "href" || name === "src") && !isSafeUrl(value)) continue;
    out.push(`${name}="${value.replace(/"/g, "&quot;")}"`);
  }
  if (tag === "img" && !seen.has("alt")) out.push('alt=""');
  return out.length ? ` ${out.join(" ")}` : "";
}

function normalizedHeading(name: string): string {
  if (name === "h1") return "h2";
  if (name === "h4" || name === "h5" || name === "h6") return "h3";
  return name;
}

export function sanitizeHtml(input: string): string {
  if (!input) return "";

  let html = input;
  for (const tag of DROP_WITH_CONTENT) {
    html = html.replace(new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, "gi"), "");
    html = html.replace(new RegExp(`<${tag}[\\s\\S]*$`, "gi"), "");
  }
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  const voidTags = new Set(["br", "hr", "img"]);
  return html.replace(
    /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g,
    (match, rawName, rawAttrs) => {
      const sourceName = String(rawName).toLowerCase();
      const name = normalizedHeading(sourceName);
      const closing = match.startsWith("</");
      if (!ALLOWED_TAGS.has(sourceName)) return "";
      if (closing) return voidTags.has(sourceName) ? "" : `</${name}>`;
      const attrs = sanitizeAttrs(sourceName, String(rawAttrs));
      return voidTags.has(sourceName)
        ? `<${name}${attrs} />`
        : `<${name}${attrs}>`;
    },
  );
}

export function looksLikeHtml(input: string): boolean {
  return HTML_DOCUMENT_START.test(input);
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function plainText(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function extractContentSteps(input: string): string[] {
  const body = input.trim();
  if (!body) return [];

  if (looksLikeHtml(body)) {
    const safe = sanitizeHtml(body);
    const listItems = Array.from(safe.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi))
      .map((match) => plainText(match[1]))
      .filter(Boolean);
    if (listItems.length) return listItems;

    const blocks = Array.from(safe.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
      .map((match) => plainText(match[1]))
      .filter(Boolean);
    if (blocks.length) return blocks;

    const withoutHeadings = safe.replace(
      /<h[23]\b[^>]*>[\s\S]*?<\/h[23]>/gi,
      " ",
    );
    return [plainText(withoutHeadings)].filter(Boolean);
  }

  const listItems = body.split(/\r?\n/).flatMap((line) => {
    if (!/^\s*(?:\d+[.)]|[-*+])\s+/.test(line)) return [];
    const text = line.replace(/^\s*(?:\d+[.)]|[-*+])\s+/, "").trim();
    return text ? [text] : [];
  });
  if (listItems.length) return listItems;

  return body
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .replace(/^#{1,6}\s+.*$/gm, "")
        .replace(/[*_`~]/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}
