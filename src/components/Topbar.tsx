import { useEffect, useState, type KeyboardEvent } from 'react'
import { api, type GlobalSearchResult } from '../api'
import { GLOBAL_SEARCH_NAVIGATION_EVENT } from '../types'
import type { Theme } from '../types'

type TopbarProps = {
  title?: string
  placeholder?: string
  theme: Theme
  toggleTheme: () => void
  minimal?: boolean
}

export function Topbar({
  title = 'TRI LTD Business Suite',
  placeholder = 'Search inventory, sales, reports...',
  theme,
  toggleTheme,
  minimal = false,
}: TopbarProps) {
  const [searchValue, setSearchValue] = useState('')
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const normalizedQuery = searchValue.trim()

  useEffect(() => {
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
  }, [normalizedQuery])

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
    } else if (event.key === 'Enter' && searchResults[0]) {
      event.preventDefault()
      selectSearchResult(searchResults[0])
    }
  }

  return (
    <header className={`topbar${minimal ? ' minimal' : ''}`}>
      <strong className="version">{title}</strong>
      {!minimal && (
        <div className="global-search">
          <label className="search">
            <span aria-hidden="true" />
            <input
              value={searchValue}
              placeholder={placeholder}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={normalizedQuery.length >= 2}
              aria-controls="global-search-results"
              onChange={(event) => {
                const value = event.target.value
                setSearchValue(value)
                setSearchLoading(value.trim().length >= 2)
                if (value.trim().length < 2) {
                  setSearchResults([])
                  setSearchError('')
                }
              }}
              onKeyDown={handleSearchKeyDown}
            />
          </label>
          {normalizedQuery.length >= 2 && (
            <div id="global-search-results" className="global-search-results" role="listbox" aria-label="Search results">
              {searchLoading && <div className="global-search-message">Searching all records…</div>}
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
              {!searchLoading && searchResults.length > 0 && <div className="global-search-hint">Enter opens the first result · Esc closes</div>}
            </div>
          )}
        </div>
      )}
      <div className="top-actions">
        <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
        {!minimal && (
          <>
            <button type="button" className="scan-button">
              Scan
            </button>
            <button type="button" aria-label="Notifications" className="icon-button bell" />
            <button type="button" aria-label="Help" className="icon-button help" />
            <button type="button" aria-label="Apps" className="icon-button apps" />
            <div className="operator" aria-label="System operator">
              <span>JD</span>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
