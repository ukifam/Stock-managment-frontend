type PaginationControlsProps = {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

export function PaginationControls({
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: PaginationControlsProps) {
  const pageCount = Math.max(1, totalPages)
  const firstItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const lastItem = Math.min(page * pageSize, totalCount)

  return (
    <nav className="list-pagination" aria-label="Table pagination">
      <span className="pagination-range">Showing {firstItem}-{lastItem} of {totalCount}</span>
      <label className="pagination-size">
        Rows
        <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
          {[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>
      <div className="pagination-navigation">
        <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>Previous</button>
        <span>Page {page} of {pageCount}</span>
        <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount}>Next</button>
      </div>
    </nav>
  )
}
