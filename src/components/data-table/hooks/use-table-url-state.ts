"use client"

import { useCallback, useMemo, useTransition } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import type {
  TableQuery,
  UseTableUrlStateOptions,
} from "../types"

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 12

interface UseTableUrlStateReturn {
  query: TableQuery
  setQuery: (query: Partial<TableQuery>) => void
  resetQuery: () => void
  /** True while the URL transition is in flight (Next.js router still streaming). */
  isPending: boolean
}

/**
 * Sync table state with URL query params (server-mode source of truth).
 *
 * Wraps every router push in `useTransition` so the page can show a subtle
 * pending state while React fetches new data — no flicker, no race.
 */
export function useTableUrlState(
  options: UseTableUrlStateOptions = {},
): UseTableUrlStateReturn {
  const { enabled = true, defaultPageSize = DEFAULT_PAGE_SIZE } = options

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const query = useMemo<TableQuery>(() => {
    if (!enabled) {
      return {
        page: DEFAULT_PAGE,
        pageSize: defaultPageSize,
        search: "",
        sortBy: null,
        sortDir: null,
        filters: {},
      }
    }

    const page = parseInt(searchParams.get("page") ?? String(DEFAULT_PAGE), 10)
    const pageSize = parseInt(
      searchParams.get("pageSize") ?? String(defaultPageSize),
      10,
    )
    const search = searchParams.get("search") ?? ""
    const sortBy = searchParams.get("sortBy") ?? null
    const sortDir = (searchParams.get("sortDir") as "asc" | "desc" | null) ?? null

    const filters: Record<string, string | string[]> = {}
    searchParams.forEach((value, key) => {
      if (key.startsWith("filter_")) {
        const filterId = key.replace("filter_", "")
        filters[filterId] = value.includes(",") ? value.split(",") : value
      }
    })

    return {
      page: Number.isNaN(page) || page < 1 ? DEFAULT_PAGE : page,
      pageSize: Number.isNaN(pageSize) || pageSize < 1 ? defaultPageSize : pageSize,
      search,
      sortBy,
      sortDir,
      filters,
    }
  }, [searchParams, enabled, defaultPageSize])

  const setQuery = useCallback(
    (updates: Partial<TableQuery>) => {
      if (!enabled) return

      const params = new URLSearchParams(searchParams.toString())

      if (updates.page !== undefined) {
        if (updates.page === DEFAULT_PAGE) params.delete("page")
        else params.set("page", String(updates.page))
      }

      if (updates.pageSize !== undefined) {
        if (updates.pageSize === defaultPageSize) params.delete("pageSize")
        else params.set("pageSize", String(updates.pageSize))
      }

      if (updates.search !== undefined) {
        if (updates.search === "") params.delete("search")
        else params.set("search", updates.search)
        params.delete("page") // search resets pagination
      }

      if (updates.sortBy !== undefined) {
        if (updates.sortBy === null) {
          params.delete("sortBy")
          params.delete("sortDir")
        } else {
          params.set("sortBy", updates.sortBy)
          params.set("sortDir", updates.sortDir ?? "asc")
        }
      }

      if (updates.filters !== undefined) {
        const keysToDelete: string[] = []
        params.forEach((_, key) => {
          if (key.startsWith("filter_")) keysToDelete.push(key)
        })
        keysToDelete.forEach((key) => params.delete(key))

        Object.entries(updates.filters).forEach(([key, value]) => {
          if (value && (Array.isArray(value) ? value.length > 0 : value !== "")) {
            const filterValue = Array.isArray(value) ? value.join(",") : value
            params.set(`filter_${key}`, filterValue)
          }
        })
        params.delete("page") // filter changes reset pagination
      }

      const queryString = params.toString()
      const url = queryString ? `${pathname}?${queryString}` : pathname
      startTransition(() => {
        router.push(url, { scroll: false })
      })
    },
    [enabled, searchParams, pathname, router, defaultPageSize],
  )

  const resetQuery = useCallback(() => {
    if (!enabled) return
    startTransition(() => {
      router.push(pathname, { scroll: false })
    })
  }, [enabled, pathname, router])

  return { query, setQuery, resetQuery, isPending }
}
