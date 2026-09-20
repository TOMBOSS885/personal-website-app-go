import { useMemo, useRef } from 'react'
import { normalizeTotpCode } from '../utils/twoFactor'

const CODE_LENGTH = 6

export default function TotpCodeInput({ value, onChange, disabled = false, autoFocus = false, idPrefix = 'totp' }) {
  const inputRefs = useRef([])
  const digits = useMemo(() => normalizeTotpCode(value).split(''), [value])

  const updateFrom = (startIndex, rawValue) => {
    const incoming = normalizeTotpCode(rawValue)
    if (!incoming) return

    const next = Array.from({ length: CODE_LENGTH }, (_, index) => digits[index] || '')
    incoming.split('').forEach((digit, offset) => {
      if (startIndex + offset < CODE_LENGTH) next[startIndex + offset] = digit
    })
    onChange(next.join(''))
    const focusIndex = Math.min(startIndex + incoming.length, CODE_LENGTH - 1)
    window.requestAnimationFrame(() => inputRefs.current[focusIndex]?.focus())
  }

  const handleChange = (index, event) => {
    const incoming = normalizeTotpCode(event.target.value)
    if (incoming) {
      updateFrom(index, incoming)
      return
    }

    const next = Array.from({ length: CODE_LENGTH }, (_, position) => digits[position] || '')
    next[index] = ''
    onChange(next.join(''))
  }

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace') {
      event.preventDefault()
      const next = Array.from({ length: CODE_LENGTH }, (_, position) => digits[position] || '')
      if (next[index]) {
        next[index] = ''
        onChange(next.join(''))
      } else if (index > 0) {
        next[index - 1] = ''
        onChange(next.join(''))
        inputRefs.current[index - 1]?.focus()
      }
      return
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault()
      inputRefs.current[index - 1]?.focus()
    }
    if (event.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      event.preventDefault()
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handlePaste = event => {
    const pasted = normalizeTotpCode(event.clipboardData.getData('text'))
    if (!pasted) return
    event.preventDefault()
    onChange(pasted)
    window.requestAnimationFrame(() => inputRefs.current[Math.min(pasted.length, CODE_LENGTH) - 1]?.focus())
  }

  return (
    <div className="grid w-full max-w-[25rem] grid-cols-6 gap-2 sm:gap-2.5" role="group" aria-label="六位动态验证码" onPaste={handlePaste}>
      {Array.from({ length: CODE_LENGTH }, (_, index) => (
        <input
          key={index}
          ref={element => { inputRefs.current[index] = element }}
          id={`${idPrefix}-${index + 1}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`动态验证码第 ${index + 1} 位`}
          value={digits[index] || ''}
          onChange={event => handleChange(index, event)}
          onKeyDown={event => handleKeyDown(index, event)}
          onFocus={event => event.target.select()}
          maxLength={index === 0 ? CODE_LENGTH : 1}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          className="aspect-square min-w-0 rounded-xl border border-slate-300 bg-white text-center text-xl font-semibold tabular-nums text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
        />
      ))}
    </div>
  )
}
