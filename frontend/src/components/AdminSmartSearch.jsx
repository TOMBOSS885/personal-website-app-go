import { Search, X } from 'lucide-react'

export default function AdminSmartSearch({ value, onChange, placeholder = '搜索', resultCount, className = '' }) {
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-3 ${className}`.trim()}>
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          className="admin-input w-full pl-9 pr-9"
          spellCheck="false"
          autoComplete="off"
        />
        {value && (
          <button type="button" onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-slate-800" title="清除搜索">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {typeof resultCount === 'number' && <span className="shrink-0 text-xs text-gray-500 dark:text-slate-400">匹配 {resultCount}</span>}
    </div>
  )
}
