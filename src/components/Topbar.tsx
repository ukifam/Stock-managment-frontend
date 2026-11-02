import { useEffect, useState, type KeyboardEvent } from 'react'
import { ACTIVE_BRANCH_STORAGE_KEY, api, type GlobalSearchResult, type OrganizationBranch } from '../api'
import { GLOBAL_SEARCH_NAVIGATION_EVENT } from '../types'
import type { Theme } from '../types'
import { useAuth } from '../context/AuthContext'
import { NotificationsPopover } from './NotificationsPopover'

type TopbarProps = {
  title?: string
  placeholder?: string
  theme: Theme
  toggleTheme: () => void
  minimal?: boolean
  onSearchChange?: (query: string) => void
}

export function Topbar({
  title = '',
  placeholder = 'Search products, sales, purchases…',
  theme,
  toggleTheme,
  minimal = false,
  onSearchChange,
}: TopbarProps) {
  const { user } = useAuth()
  const [searchValue, setSearchValue] = useState('')
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [branches, setBranches] = useState<OrganizationBranch[]>([])
  const [activeBranchCode, setActiveBranchCode] = useState('')
  const normalizedQuery = searchValue.trim()

  useEffect(() => {
    if (onSearchChange) return
    if (normalizedQuery.length < 2) return

    let isCurrent = true
    const timeout = window.setTimeout(() => {
      api.searchAll(normalizedQuery)
        .then((response) => {
          if (!isCurrent) return
          setSearchResults(response.results)
          setSearchError('')
        })
        .catch(() => {
          if (isCurrent) {
            setSearchResults([])
            setSearchError('Search is unavailable right now.')
          }
        })
        .finally(() => {
          if (isCurrent) setSearchLoading(false)
        })
    }, 250)

    return () => {
      isCurrent = false
      window.clearTimeout(timeout)
    }
  }, [normalizedQuery, onSearchChange])

  useEffect(() => {
    if (!user || minimal) return

    let isCurrent = true
    api.organization()
      .then((organization) => {
        if (!isCurrent) return
        const available = organization.branches.filter((branch) => branch.active)
        const stored = localStorage.getItem(ACTIVE_BRANCH_STORAGE_KEY) || ''
        const selected = available.find((branch) => branch.code === stored)
          ? stored
          : organization.activeBranchCode || available[0]?.code || ''
        setBranches(available)
        setActiveBranchCode(selected)
        if (selected && selected !== stored) localStorage.setItem(ACTIVE_BRANCH_STORAGE_KEY, selected)
      })
      .catch(() => {
        if (isCurrent) {
          setBranches([])
          setActiveBranchCode('')
        }
      })

    return () => { isCurrent = false }
  }, [minimal, user])

  const selectSearchResult = (result: GlobalSearchResult) => {
    window.dispatchEvent(new CustomEvent<GlobalSearchResult>(GLOBAL_SEARCH_NAVIGATION_EVENT, { detail: result }))
    setSearchValue('')
    setSearchResults([])
    setSearchError('')
    setSearchLoading(false)
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setSearchValue('')
      setSearchResults([])
      setSearchError('')
      setSearchLoading(false)
      onSearchChange?.('')
    } else if (!onSearchChange && event.key === 'Enter' && searchResults[0]) {
      event.preventDefault()
      selectSearchResult(searchResults[0])
    }
  }

  return (
    <header className={`topbar${minimal ? ' minimal' : ''}`}>
      {title && <strong className="version">{title}</strong>}
      {!minimal && (
        <div className="global-search">
          <label className="search">
            <span aria-hidden="true" />
            <input
              value={searchValue}
              placeholder={placeholder}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={!onSearchChange && normalizedQuery.length >= 2}
              aria-controls="global-search-results"
              onChange={(event) => {
                const value = event.target.value
                setSearchValue(value)
                onSearchChange?.(value)
                setSearchLoading(!onSearchChange && value.trim().length >= 2)
                if (value.trim().length < 2) {
                  setSearchResults([])
                  setSearchError('')
                }
              }}
              onKeyDown={handleSearchKeyDown}
            />
          </label>
          {!onSearchChange && normalizedQuery.length >= 2 && (
            <div id="global-search-results" className="global-search-results" role="listbox" aria-label="Search results">
              {searchLoading && <div className="global-search-message">Searching…</div>}
              {!searchLoading && searchError && <div className="global-search-message error">{searchError}</div>}
              {!searchLoading && !searchError && searchResults.length === 0 && <div className="global-search-message">No matching records.</div>}
              {!searchLoading && searchResults.map((result) => (
                <button
                  type="button"
                  className="global-search-result"
                  role="option"
                  aria-selected="false"
                  key={`${result.type}-${result.id}`}
                  onClick={() => selectSearchResult(result)}
                >
                  <span className="global-search-result-copy"><strong>{result.title}</strong><small>{result.subtitle}</small></span>
                  <span className="global-search-result-type">{result.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="top-actions">
        {!minimal && branches.length > 1 && (
          <label className="branch-switcher">
            <span>Branch</span>
            <select
              value={activeBranchCode}
              onChange={(event) => {
                localStorage.setItem(ACTIVE_BRANCH_STORAGE_KEY, event.target.value)
                window.location.reload()
              }}
              aria-label="Active branch"
            >
              {branches.map((branch) => <option key={branch.code} value={branch.code}>{branch.name}</option>)}
            </select>
          </label>
        )}
        <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          {theme === 'dark' ? '☀' : '☾'}
        </button>
        {!minimal && <NotificationsPopover />}
      </div>
    </header>
  )
}
