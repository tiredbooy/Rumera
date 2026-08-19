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

/**
 * One rendered method step, as schema.org/HowToStep consumes it.
 *
 * `image` carries the step's own illustration when the author placed one inside
 * the step — Google renders it in the how-to carousel, and it is the single
 * biggest thing a structured step list adds over a prose blob.
 */
export type ContentStep = { text: string; image?: string };

/**
 * Index of the `</tag>` that closes the element opened before `from`, or -1.
 * Regex cannot balance tags, so this counts depth over the same tag name — the
 * cheapest correct way to find the end of a list that contains nested lists.
 */
function matchingClose(html: string, tag: string, from: number): number {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  re.lastIndex = from;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    if (match[1]) {
      if (depth === 0) return match.index;
      depth -= 1;
    } else {
      depth += 1;
    }
  }
  return -1;
}

/** Inner HTML of the direct `<li>` children of `inner`, nested lists skipped. */
function topLevelListItems(inner: string): string[] {
  const items: string[] = [];
  const re = /<(\/?)li\b[^>]*>/gi;
  let depth = 0;
  let start = -1;
  let match: RegExpExecArray | null;
  while ((match = re.exec(inner)) !== null) {
    if (match[1]) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        items.push(inner.slice(start, match.index));
        start = -1;
      }
    } else {
      if (depth === 0) start = match.index + match[0].length;
      depth += 1;
    }
  }
  return items;
}

/**
 * Inner HTML of each step in the canonical method list — the first `<ol>` — or
 * null when the body has none. An ordered list is the only unambiguous step
 * marker that survives `sanitizeHtml` (it drops classes and data attributes),
 * so it is what the recipe step editor writes and what this reads back.
 */
export function orderedListItems(html: string): string[] | null {
  const open = /<ol\b[^>]*>/i.exec(html);
  if (!open) return null;
  const start = open.index + open[0].length;
  const end = matchingClose(html, "ol", start);
  if (end < 0) return null;
  const items = topLevelListItems(html.slice(start, end));
  return items.length ? items : null;
}

function firstImageSrc(html: string): string | undefined {
  const match = /<img\b[^>]*\bsrc="([^"]*)"/i.exec(html);
  const src = match?.[1]?.trim();
  return src || undefined;
}

function toStep(html: string): ContentStep {
  const image = firstImageSrc(html);
  return image ? { text: plainText(html), image } : { text: plainText(html) };
}

/**
 * Method steps for structured data.
 *
 * The ordered list wins outright: a body written in the step editor is one
 * `<ol>`, and reading only its items keeps an unrelated `<ul>` of tips out of
 * `recipeInstructions`. Everything below it is the legacy blob path, kept so
 * recipes that never passed through the step editor still emit HowToStep.
 */
export function extractContentSteps(input: string): ContentStep[] {
  const body = input.trim();
  if (!body) return [];

  if (looksLikeHtml(body)) {
    const safe = sanitizeHtml(body);
    const ordered = orderedListItems(safe);
    if (ordered) {
      const steps = ordered.map(toStep).filter((step) => step.text);
      if (steps.length) return steps;
    }

    const listItems = topLevelListItems(safe)
      .map(toStep)
      .filter((step) => step.text);
    if (listItems.length) return listItems;

    const blocks = Array.from(safe.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
      .map((match) => toStep(match[1]))
      .filter((step) => step.text);
    if (blocks.length) return blocks;

    const withoutHeadings = safe.replace(
      /<h[23]\b[^>]*>[\s\S]*?<\/h[23]>/gi,
      " ",
    );
    return [toStep(withoutHeadings)].filter((step) => step.text);
  }

  const listItems = body.split(/\r?\n/).flatMap((line) => {
    if (!/^\s*(?:\d+[.)]|[-*+])\s+/.test(line)) return [];
    const text = line.replace(/^\s*(?:\d+[.)]|[-*+])\s+/, "").trim();
    return text ? [{ text }] : [];
  });
  if (listItems.length) return listItems;

  return body
    .split(/\n\s*\n/)
    .map((block) => ({
      text: block
        .replace(/^#{1,6}\s+.*$/gm, "")
        .replace(/[*_`~]/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    }))
    .filter((step) => step.text);
}
