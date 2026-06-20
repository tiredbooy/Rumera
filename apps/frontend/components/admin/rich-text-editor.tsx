"use client"

import * as React from "react"
import { useEditor, EditorContent, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Quote,
  Link as LinkIcon,
  Undo2,
  Redo2,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Premium, RTL-aware rich-text editor for recipe content, built on Tiptap.
 *
 * Emits HTML via `onChange`. Keyboard-accessible toolbar (every control is a real
 * <button> with a Persian aria-label and an active state), respects the cellar
 * design tokens, and never reaches for `left`/`right` — logical props only.
 */

type ToolButton = {
  icon: LucideIcon
  label: string
  isActive?: (e: Editor) => boolean
  run: (e: Editor) => void
  disabled?: (e: Editor) => boolean
}

function buildTools(promptLink: (e: Editor) => void): (ToolButton | "divider")[] {
  return [
    {
      icon: Bold,
      label: "درشت",
      isActive: (e) => e.isActive("bold"),
      run: (e) => e.chain().focus().toggleBold().run(),
    },
    {
      icon: Italic,
      label: "کج",
      isActive: (e) => e.isActive("italic"),
      run: (e) => e.chain().focus().toggleItalic().run(),
    },
    {
      icon: UnderlineIcon,
      label: "زیرخط",
      isActive: (e) => e.isActive("underline"),
      run: (e) => e.chain().focus().toggleUnderline().run(),
    },
    "divider",
    {
      icon: Heading2,
      label: "سرتیتر بزرگ",
      isActive: (e) => e.isActive("heading", { level: 2 }),
      run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      icon: Heading3,
      label: "سرتیتر کوچک",
      isActive: (e) => e.isActive("heading", { level: 3 }),
      run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    "divider",
    {
      icon: List,
      label: "فهرست نقطه‌ای",
      isActive: (e) => e.isActive("bulletList"),
      run: (e) => e.chain().focus().toggleBulletList().run(),
    },
    {
      icon: ListOrdered,
      label: "فهرست شماره‌دار",
      isActive: (e) => e.isActive("orderedList"),
      run: (e) => e.chain().focus().toggleOrderedList().run(),
    },
    {
      icon: Quote,
      label: "نقل‌قول",
      isActive: (e) => e.isActive("blockquote"),
      run: (e) => e.chain().focus().toggleBlockquote().run(),
    },
    {
      icon: LinkIcon,
      label: "پیوند",
      isActive: (e) => e.isActive("link"),
      run: promptLink,
    },
    "divider",
    {
      icon: Undo2,
      label: "بازگردانی",
      run: (e) => e.chain().focus().undo().run(),
      disabled: (e) => !e.can().undo(),
    },
    {
      icon: Redo2,
      label: "ازنو",
      run: (e) => e.chain().focus().redo().run(),
      disabled: (e) => !e.can().redo(),
    },
  ]
}

export function RichTextEditor({
  value,
  onChange,
  id,
  ariaInvalid,
  ariaDescribedBy,
  placeholder = "روش تهیه را گام‌به‌گام بنویسید…",
}: {
  value: string
  onChange: (html: string) => void
  id?: string
  ariaInvalid?: boolean
  ariaDescribedBy?: string
  placeholder?: string
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", class: "text-primary underline" },
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        // The editable surface itself is the labelled control.
        id: id ?? "",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "محتوای دستور",
        ...(ariaInvalid ? { "aria-invalid": "true" } : {}),
        ...(ariaDescribedBy ? { "aria-describedby": ariaDescribedBy } : {}),
        class:
          "prose-recipe min-h-44 w-full px-4 py-3 text-sm leading-7 outline-none focus-visible:outline-none",
        "data-placeholder": placeholder,
      },
    },
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML()
      // Tiptap emits "<p></p>" for an empty doc; normalise to "" so required-validation works.
      onChange(html === "<p></p>" ? "" : html)
    },
  })

  // Keep the editor in sync when the form resets / loads async defaults.
  React.useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    const next = value || ""
    if (next !== current && !(next === "" && current === "<p></p>")) {
      editor.commands.setContent(next, { emitUpdate: false })
    }
  }, [value, editor])

  const promptLink = React.useCallback((e: Editor) => {
    const previous = e.getAttributes("link").href as string | undefined
    const url = window.prompt("نشانی پیوند (URL):", previous ?? "https://")
    if (url === null) return
    if (url.trim() === "") {
      e.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    e.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run()
  }, [])

  const tools = React.useMemo(() => buildTools(promptLink), [promptLink])

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-input/30 transition-[box-shadow,border-color] duration-200",
        "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
        ariaInvalid && "border-destructive ring-3 ring-destructive/20"
      )}
    >
      <div
        role="toolbar"
        aria-label="ابزار قالب‌بندی متن"
        aria-orientation="horizontal"
        className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 px-1.5 py-1.5"
      >
        {editor
          ? tools.map((tool, i) =>
              tool === "divider" ? (
                <span
                  key={`d-${i}`}
                  aria-hidden
                  className="mx-1 h-5 w-px self-center bg-border/70"
                />
              ) : (
                <button
                  key={tool.label}
                  type="button"
                  aria-label={tool.label}
                  aria-pressed={tool.isActive ? tool.isActive(editor) : undefined}
                  disabled={tool.disabled ? tool.disabled(editor) : false}
                  onClick={() => tool.run(editor)}
                  className={cn(
                    "inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors",
                    "hover:bg-background hover:text-foreground",
                    "focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
                    "disabled:pointer-events-none disabled:opacity-40",
                    tool.isActive && tool.isActive(editor) && "bg-background text-primary shadow-e1"
                  )}
                >
                  <tool.icon className="size-4" />
                </button>
              )
            )
          : null}
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
