"use client"

import * as React from "react"
import { ImagePlus, Link2, Loader2, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// --- Mock upload API -------------------------------------------------
// Swap this out for a real call once the upload endpoint exists, e.g.:
//   const form = new FormData()
//   form.append("file", file)
//   const res = await fetch("/api/admin/uploads", { method: "POST", body: form })
//   const { url } = await res.json()
//   return url
async function mockUploadImage(file: File): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 900))
  // Fake CDN-style URL just so the flow feels real in the UI.
  const fakeId = Math.random().toString(36).slice(2, 10)
  return `https://cdn.example.com/categories/${fakeId}-${encodeURIComponent(file.name)}`
}

export function ImageUrlInput({
  id,
  value,
  onChange,
  error,
}: {
  id: string
  value: string
  onChange: (url: string) => void
  error?: string
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = React.useState(false)
  const [localPreview, setLocalPreview] = React.useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return

    const objectUrl = URL.createObjectURL(file)
    setLocalPreview(objectUrl)
    setIsUploading(true)

    try {
      const url = await mockUploadImage(file)
      onChange(url)
    } finally {
      setIsUploading(false)
    }
  }

  function clear() {
    onChange("")
    setLocalPreview(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  // Prefer the freshly-uploaded local preview while it's uploading; once
  // `value` is populated (either from upload or manual paste), use that.
  const previewSrc = value || localPreview

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "border-hairline relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted/40 ring-1 ring-foreground/[0.04]",
          )}
        >
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt=""
              className="size-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none"
              }}
            />
          ) : (
            <ImagePlus className="size-5 text-muted-foreground" />
          )}
          {isUploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading}
              onClick={() => inputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ImagePlus className="size-3.5" />
              )}
              آپلود تصویر
            </Button>
            {previewSrc ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clear}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="size-3.5" />
                حذف
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            یک فایل آپلود کنید یا نشانی تصویر را مستقیم زیر وارد کنید.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <div className="relative">
        <Link2 className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          dir="ltr"
          placeholder="https://…"
          inputMode="url"
          value={value}
          onChange={(e) => {
            setLocalPreview(null)
            onChange(e.target.value)
          }}
          aria-invalid={!!error}
          className="ps-9"
        />
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}