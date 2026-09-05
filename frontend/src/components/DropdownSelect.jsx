import { createPortal } from 'react-dom'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export default function DropdownSelect({ value, onChange, options, className = '', id, disabled = false, 'aria-label': ariaLabel }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState(null)
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const current = options.find(option => String(option.value) === String(value)) || options[0]

  const updatePosition = () => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const width = Math.max(rect.width, 160)
    const maxLeft = window.innerWidth - width - 8
    const left = Math.min(Math.max(8, rect.left), Math.max(8, maxLeft))
    const below = window.innerHeight - rect.bottom - 8
    const above = rect.top - 8
    const estimatedHeight = Math.min(options.length * 36 + 8, 280)
    const flip = below < estimatedHeight && above > below
    setPosition({ left, width, top: flip ? Math.max(8, rect.top - Math.min(estimatedHeight, above)) : rect.bottom + 4, maxHeight: flip ? Math.max(120, above) : Math.max(120, below) })
  }

  useLayoutEffect(() => { if (open) updatePosition() }, [open, options.length])
  useEffect(() => {
    if (!open) return undefined
    const close = event => { if (event.type === 'keydown' && event.key === 'Escape') setOpen(false); else if (event.type === 'pointerdown' && !rootRef.current?.contains(event.target)) setOpen(false) }
    const reposition = () => updatePosition()
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); window.removeEventListener('resize', reposition); window.removeEventListener('scroll', reposition, true) }
  }, [open])

  const choose = next => { onChange?.({ target: { value: next } }); setOpen(false); buttonRef.current?.focus() }
  return <div ref={rootRef} className="relative" id={id}>
    <button ref={buttonRef} type="button" disabled={disabled} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(currentOpen => !currentOpen)} className={`flex w-full items-center justify-between gap-3 ${className}`}>
      <span className="min-w-0 truncate">{current?.label ?? value}</span><ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
    </button>
    {open && position && createPortal(<div role="listbox" aria-label={ariaLabel} style={{ position: 'fixed', left: position.left, top: position.top, width: position.width, maxHeight: position.maxHeight, overflowY: 'auto' }} className="z-[1000] rounded-lg border border-slate-200 bg-white p-1 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
      {options.map(option => <button key={String(option.value)} type="button" role="option" aria-selected={String(option.value) === String(value)} onClick={() => choose(option.value)} className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50 dark:text-slate-200 dark:hover:bg-slate-800"><span className="truncate">{option.label}</span>{String(option.value) === String(value) && <Check className="h-4 w-4 shrink-0 text-indigo-600" />}</button>)}
    </div>, document.body)}
  </div>
}
