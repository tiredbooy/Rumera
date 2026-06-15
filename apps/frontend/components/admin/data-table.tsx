"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { faNum } from "@/lib/products"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type Column<T> = {
  id: string
  header: string
  cell: (row: T) => React.ReactNode
  /** Provide to make the column sortable. */
  sortValue?: (row: T) => number | string
  align?: "start" | "end" | "center"
  className?: string
}

export type Filter<T> = {
  id: string
  label: string
  options: { value: string; label: string }[]
  getValue: (row: T) => string
}

type SortState = { id: string; dir: "asc" | "desc" } | null

/**
 * Generic, self-contained admin table: client-side search, column sort, faceted
 * filters and pagination over an in-memory array. State is local (no URL sync) so
 * it drops into any page without provider wiring. Swap `rows` for a query result
 * when the API lands — the props don't change.
 */
export function DataTable<T>({
  rows,
  columns,
  getRowKey,
  searchText,
  searchPlaceholder = "جستجو…",
  filters = [],
  pageSize = 8,
  rowHref,
  toolbarExtra,
  emptyMessage = "موردی یافت نشد.",
}: {
  rows: T[]
  columns: Column<T>[]
  getRowKey: (row: T) => string
  searchText?: (row: T) => string
  searchPlaceholder?: string
  filters?: Filter<T>[]
  pageSize?: number
  rowHref?: (row: T) => string
  toolbarExtra?: React.ReactNode
  emptyMessage?: string
}) {
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const [facets, setFacets] = React.useState<Record<string, string>>({})
  const [sort, setSort] = React.useState<SortState>(null)
  const [page, setPage] = React.useState(0)

  const filtered = React.useMemo(() => {
    let out = rows
    const q = query.trim().toLowerCase()
    if (q && searchText) {
      out = out.filter((r) => searchText(r).toLowerCase().includes(q))
    }
    for (const f of filters) {
      const v = facets[f.id]
      if (v && v !== "all") out = out.filter((r) => f.getValue(r) === v)
    }
    if (sort) {
      const col = columns.find((c) => c.id === sort.id)
      if (col?.sortValue) {
        const dir = sort.dir === "asc" ? 1 : -1
        out = [...out].sort((a, b) => {
          const av = col.sortValue!(a)
          const bv = col.sortValue!(b)
          if (av < bv) return -1 * dir
          if (av > bv) return 1 * dir
          return 0
        })
      }
    }
    return out
  }, [rows, query, facets, sort, filters, columns, searchText])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, pageCount - 1)
  const paged = filtered.slice(current * pageSize, current * pageSize + pageSize)

  // Reset to the first page whenever the result set changes (search/filter/sort).
  function setQueryReset(value: string) {
    setQuery(value)
    setPage(0)
  }
  function setFacetReset(id: string, value: string) {
    setFacets((prev) => ({ ...prev, [id]: value }))
    setPage(0)
  }
  function toggleSort(id: string) {
    setPage(0)
    setSort((s) => {
      if (s?.id !== id) return { id, dir: "asc" }
      if (s.dir === "asc") return { id, dir: "desc" }
      return null
    })
  }

  const hasToolbar = Boolean(searchText) || filters.length > 0 || toolbarExtra

  return (
    <div className="flex flex-col gap-4">
      {hasToolbar ? (
        <div className="flex flex-wrap items-center gap-3">
          {searchText ? (
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQueryReset(e.target.value)}
                placeholder={searchPlaceholder}
                className="ps-9"
                aria-label="جستجو"
              />
            </div>
          ) : null}

          {filters.map((f) => (
            <Select
              key={f.id}
              value={facets[f.id] ?? "all"}
              onValueChange={(v) => setFacetReset(f.id, v)}
            >
              <SelectTrigger size="sm" className="w-auto min-w-36">
                <SelectValue placeholder={f.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{f.label}: همه</SelectItem>
                {f.options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}

          <div className="ms-auto flex items-center gap-3">
            {toolbarExtra}
            <span className="text-sm text-muted-foreground">
              {faNum(filtered.length)} مورد
            </span>
          </div>
        </div>
      ) : null}

      <div className="border-hairline overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/5">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((col) => {
                const active = sort?.id === col.id
                const alignCls =
                  col.align === "end"
                    ? "text-end"
                    : col.align === "center"
                      ? "text-center"
                      : "text-start"
                return (
                  <TableHead key={col.id} className={cn(alignCls, col.className)}>
                    {col.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.id)}
                        className={cn(
                          "inline-flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground",
                          active ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {col.header}
                        {active ? (
                          sort?.dir === "asc" ? (
                            <ChevronUp className="size-3.5" />
                          ) : (
                            <ChevronDown className="size-3.5" />
                          )
                        ) : (
                          <ChevronsUpDown className="size-3.5 opacity-50" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="h-40">
                  <div className="flex flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                    <Inbox className="size-7 opacity-60" />
                    <p className="text-sm">{emptyMessage}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paged.map((row) => {
                const href = rowHref?.(row)
                return (
                  <TableRow
                    key={getRowKey(row)}
                    onClick={href ? () => router.push(href) : undefined}
                    className={cn(href && "cursor-pointer")}
                  >
                    {columns.map((col) => {
                      const alignCls =
                        col.align === "end"
                          ? "text-end"
                          : col.align === "center"
                            ? "text-center"
                            : "text-start"
                      return (
                        <TableCell key={col.id} className={cn(alignCls, col.className)}>
                          {col.cell(row)}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            صفحهٔ {faNum(current + 1)} از {faNum(pageCount)}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              <ChevronRight className="size-4" /> قبلی
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={current >= pageCount - 1}
              onClick={() => setPage(current + 1)}
            >
              بعدی <ChevronLeft className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
