import { looksLikeHtml } from "@/lib/content/sanitize-html";

/**
 * CE-5. The recipe method as real steps.
 *
 * Storage is one `content` column. The canonical method is an `<ol>` of
 * `<li>` steps — that is what the storefront renders and what
 * `extractContentSteps` reads for HowToStep.
 *
 * Legacy bodies are mixed: intro prose, a heading, a numbered list, a tips
 * `<ul>`, a GFM table. Those non-step blocks must stay *outside* the `<ol>`
 * so they are not deleted on first edit and so they are not promoted into
 * HowToStep. `joinMethod(splitMethod(x))` must keep every word.
 */

export type MethodStep = { id: string; html: string };

export type MethodDocument = {
  preamble: string;
  steps: MethodStep[];
  appendix: string;
  /** The body was already a lone ordered list — nothing was reshaped. */
  canonical: boolean;
};

let stepCounter = 0;

export function newStep(html = ""): MethodStep {
  stepCounter += 1;
  return { id: `step-${stepCounter}`, html };
}

/** Compare visible words, ignoring markup, list markers and table pipes. */
export function methodPlainText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s*(?:\d+[.)]|[-*+#]+)\s+/gm, "")
    .replace(/\|/g, " ")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function methodPreservesText(original: string, joined: string): boolean {
  return methodPlainText(original) === methodPlainText(joined);
}

/** A step is empty when it carries neither words nor an image. */
export function isEmptyStep(html: string): boolean {
  if (/<img\b/i.test(html)) return false;
  return (
    html
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim() === ""
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function parseBody(html: string): HTMLElement | null {
  if (typeof DOMParser === "undefined") return null;
  return new DOMParser().parseFromString(`<body>${html}</body>`, "text/html")
    .body;
}

function serializeNodes(nodes: ChildNode[]): string {
  return nodes
    .map((node) => {
      if (node.nodeType === 3) {
        const text = (node.textContent ?? "").trim();
        return text ? `<p>${escapeHtml(text)}</p>` : "";
      }
      if (node.nodeType === 1) return (node as Element).outerHTML;
      return "";
    })
    .join("");
}

function listItems(element: Element): string[] {
  return Array.from(element.children)
    .filter((child) => child.tagName.toLowerCase() === "li")
    .map((child) => child.innerHTML.trim())
    .filter((inner) => !isEmptyStep(inner));
}

function splitHtml(root: HTMLElement): Omit<MethodDocument, "canonical"> {
  const children = Array.from(root.childNodes).filter((node) => {
    if (node.nodeType === 3) return (node.textContent ?? "").trim() !== "";
    return node.nodeType === 1;
  });

  const firstOl = children.findIndex(
    (node) =>
      node.nodeType === 1 && (node as Element).tagName.toLowerCase() === "ol",
  );

  if (firstOl >= 0) {
    const ol = children[firstOl] as Element;
    return {
      preamble: serializeNodes(children.slice(0, firstOl)),
      steps: listItems(ol).map((html) => newStep(html)),
      appendix: serializeNodes(children.slice(firstOl + 1)),
    };
  }

  const preambleNodes: ChildNode[] = [];
  const stepHtml: string[] = [];
  const appendixNodes: ChildNode[] = [];
  let seenStep = false;
  let open = "";

  const flushOpen = () => {
    if (!isEmptyStep(open)) {
      stepHtml.push(open.trim());
      seenStep = true;
    }
    open = "";
  };

  for (const node of children) {
    if (node.nodeType === 3) {
      flushOpen();
      const text = (node.textContent ?? "").trim();
      if (text) {
        stepHtml.push(`<p>${escapeHtml(text)}</p>`);
        seenStep = true;
      }
      continue;
    }
    const element = node as Element;
    const tag = element.tagName.toLowerCase();

    if (tag === "ul") {
      flushOpen();
      if (!seenStep) {
        for (const inner of listItems(element)) stepHtml.push(inner);
        seenStep = stepHtml.length > 0;
      } else {
        appendixNodes.push(element);
      }
      continue;
    }
    if (/^h[1-6]$/.test(tag) || tag === "table" || tag === "hr") {
      flushOpen();
      if (!seenStep) preambleNodes.push(element);
      else appendixNodes.push(element);
      continue;
    }
    if (tag === "p" || tag === "blockquote" || tag === "pre") {
      flushOpen();
      open = element.outerHTML;
      continue;
    }
    // Images/figures attach to the open step, otherwise start one.
    if (!open && seenStep === false && preambleNodes.length && !stepHtml.length) {
      open = element.outerHTML;
      continue;
    }
    open += element.outerHTML;
  }
  flushOpen();

  return {
    preamble: serializeNodes(preambleNodes),
    steps: stepHtml.map((html) => newStep(html)),
    appendix: serializeNodes(appendixNodes),
  };
}

const LIST_LINE = /^\s*(?:\d+[.)]|[-*+])\s+(.*)$/;

function isTableBlock(block: string): boolean {
  const lines = block.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return false;
  return lines.every((line) => /^\s*\|.+\|\s*$/.test(line));
}

function markdownBlocksToHtml(source: string): string {
  const trimmed = source.trim();
  if (!trimmed) return "";
  return trimmed
    .split(/\n\s*\n/)
    .map((block) => {
      const body = block.trim();
      if (!body) return "";
      if (isTableBlock(body)) return `<pre>${escapeHtml(body)}</pre>`;
      return `<p>${escapeHtml(body.replace(/\s+/g, " "))}</p>`;
    })
    .join("");
}

function splitPlain(body: string): Omit<MethodDocument, "canonical"> {
  const lines = body.split(/\r?\n/);
  let first = -1;
  let last = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (LIST_LINE.test(lines[i])) {
      if (first < 0) first = i;
      last = i;
    }
  }

  if (first < 0) {
    const preamble: string[] = [];
    const stepTexts: string[] = [];
    const appendix: string[] = [];
    let seenStep = false;
    for (const block of body.split(/\n\s*\n/)) {
      const trimmed = block.trim();
      if (!trimmed) continue;
      if (isTableBlock(trimmed)) {
        if (seenStep) appendix.push(trimmed);
        else preamble.push(trimmed);
        continue;
      }
      seenStep = true;
      stepTexts.push(trimmed);
    }
    return {
      preamble: markdownBlocksToHtml(preamble.join("\n\n")),
      steps: stepTexts.map((text) => newStep(`<p>${escapeHtml(text)}</p>`)),
      appendix: markdownBlocksToHtml(appendix.join("\n\n")),
    };
  }

  const before = lines.slice(0, first).join("\n");
  const after = lines.slice(last + 1).join("\n");
  const stepTexts: string[] = [];
  const leftover: string[] = [];
  for (const line of lines.slice(first, last + 1)) {
    const match = LIST_LINE.exec(line);
    if (match?.[1]?.trim()) {
      stepTexts.push(match[1].trim());
      continue;
    }
    if (line.trim()) leftover.push(line);
  }

  return {
    preamble: markdownBlocksToHtml(before),
    steps: stepTexts.map((text) => newStep(`<p>${escapeHtml(text)}</p>`)),
    appendix: markdownBlocksToHtml([...leftover, after].filter((part) => part.trim()).join("\n\n")),
  };
}

/** Split a stored method body into editable steps plus surrounding prose. */
export function splitMethod(content: string): MethodDocument {
  const body = content.trim();
  if (!body) {
    return { preamble: "", steps: [], appendix: "", canonical: true };
  }

  if (!looksLikeHtml(body)) {
    return { ...splitPlain(body), canonical: false };
  }

  const root = parseBody(body);
  if (!root) {
    return {
      preamble: "",
      steps: [newStep(body)],
      appendix: "",
      canonical: false,
    };
  }

  const elements = Array.from(root.children);
  const canonical =
    elements.length === 1 &&
    elements[0].tagName.toLowerCase() === "ol" &&
    (root.textContent ?? "").trim() === (elements[0].textContent ?? "").trim();

  const split = splitHtml(root);
  return { ...split, canonical };
}

function joinSteps(steps: MethodStep[]): string {
  const items = steps
    .map((step) => step.html.trim())
    .filter((html) => !isEmptyStep(html))
    .map((html) => `<li>${html}</li>`)
    .join("");
  return items ? `<ol>${items}</ol>` : "";
}

/** Serialise a split document (or a bare step list) back to `content`. */
export function joinMethod(input: MethodStep[] | MethodDocument): string {
  if (Array.isArray(input)) return joinSteps(input);
  return `${input.preamble}${joinSteps(input.steps)}${input.appendix}`;
}
