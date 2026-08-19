import { Node, mergeAttributes } from "@tiptap/core";
import type { DOMOutputSpec } from "@tiptap/pm/model";

/**
 * CE-4. The two block nodes the editorial renderer already understands but the
 * editor could not produce.
 *
 * Both serialise to exactly what `sanitizeHtml` keeps — `<img src alt title>`
 * and a plain `<table>` of `<th>`/`<td>` text — because the renderer is the
 * contract. Anything richer (classes, data attributes, figure captions) is
 * dropped on the public page, so the editor never writes it.
 *
 * Written against `@tiptap/core` rather than `@tiptap/extension-image` and
 * `-table`: neither is installed, and a static table plus an atom image is a
 * fraction of the code prosemirror-tables would need wiring.
 */

export const EditorImage = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
      title: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "img[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes)];
  },
});

export type TableGrid = {
  /** Row-major cell text. The first row is the header when `header` is true. */
  rows: string[][];
  header: boolean;
};

export const EMPTY_TABLE: TableGrid = {
  header: true,
  rows: [
    ["", ""],
    ["", ""],
  ],
};

function readTable(dom: HTMLElement): TableGrid | false {
  const rows = Array.from(dom.querySelectorAll("tr"))
    .map((row) =>
      Array.from(row.children).map((cell) =>
        (cell.textContent ?? "").replace(/\s+/g, " ").trim(),
      ),
    )
    .filter((row) => row.length > 0);
  if (!rows.length) return false;
  return { rows, header: dom.querySelector("th") !== null };
}

function renderTable(grid: TableGrid): DOMOutputSpec {
  const rows = grid.rows.length ? grid.rows : EMPTY_TABLE.rows;
  const body: DOMOutputSpec[] = [];
  if (grid.header) {
    body.push([
      "thead",
      {},
      ["tr", {}, ...rows[0].map((cell) => ["th", {}, cell] as DOMOutputSpec)],
    ]);
  }
  const bodyRows = grid.header ? rows.slice(1) : rows;
  body.push([
    "tbody",
    {},
    ...bodyRows.map(
      (row) =>
        [
          "tr",
          {},
          ...row.map((cell) => ["td", {}, cell] as DOMOutputSpec),
        ] as DOMOutputSpec,
    ),
  ]);
  return ["table", {}, ...body] as DOMOutputSpec;
}

/**
 * A table as one atom holding its grid of plain-text cells, edited through a
 * dialog rather than in place.
 *
 * ponytail: cells are text only, no inline marks inside a cell. In-place cell
 * editing means prosemirror-tables (selection plugin, column resizing, cell
 * commands); add it if authors ask for bold inside a cell.
 */
export const EditorTable = Node.create({
  name: "simpleTable",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      rows: { default: EMPTY_TABLE.rows },
      header: { default: true },
    };
  },

  parseHTML() {
    return [
      {
        tag: "table",
        getAttrs: (element) => readTable(element as HTMLElement),
      },
    ];
  },

  renderHTML({ node }) {
    return renderTable(node.attrs as TableGrid);
  },
});
