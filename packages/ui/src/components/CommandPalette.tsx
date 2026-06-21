import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Icon } from './Icon.js'

export interface CommandItem {
  id: string
  /** Group header (rendered as `// group · count`). */
  group: string
  label: string
  sub?: string
  icon?: ReactNode
  /** Optional keyboard hint shown on the right (e.g. `⌘N`). */
  kbd?: string
  run: () => void
}

/**
 * ⌘K command palette (design-v2 `CmdKOverlay`). Presentational + keyboard-driven; the host owns
 * `open`/`onClose` and supplies the `commands` (navigate targets + quick actions). Renders on the
 * ported `.wfp-cmdk-*` classes. ↑↓ move · ↵ run · esc close · click-outside closes.
 */
export function CommandPalette({
  open,
  onClose,
  commands,
  placeholder = 'Пошук або команда…',
}: {
  open: boolean
  onClose: () => void
  commands: CommandItem[]
  placeholder?: string
}) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    const t = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => `${c.label} ${c.sub ?? ''}`.toLowerCase().includes(q))
  }, [commands, query])

  // Keep the active index within bounds as the filtered list shrinks.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, filtered.length - 1)))
  }, [filtered.length])

  if (!open) return null

  const groups: { group: string; items: CommandItem[] }[] = []
  for (const c of filtered) {
    let g = groups.find((x) => x.group === c.group)
    if (!g) {
      g = { group: c.group, items: [] }
      groups.push(g)
    }
    g.items.push(c)
  }

  const run = (i: number) => {
    const c = filtered[i]
    if (c) {
      onClose()
      c.run()
    }
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      run(active)
    }
  }

  let offset = 0
  return (
    <div className="wfp-cmdk-overlay" onMouseDown={onClose}>
      <div className="wfp-cmdk" onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKey}>
        <div className="wfp-cmdk-input">
          <Icon name="search" size={15} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            style={{ flex: 1, background: 'none', border: 0, outline: 'none', color: 'inherit' }}
          />
          <span className="wfp-cmdk-row-kbd">esc</span>
        </div>
        <div className="wfp-cmdk-body">
          {filtered.length === 0 ? (
            <div className="wfp-cmdk-group">// нічого не знайдено</div>
          ) : (
            groups.map((g) => {
              const base = offset
              offset += g.items.length
              return (
                <div key={g.group}>
                  <div className="wfp-cmdk-group">
                    // {g.group} · {g.items.length}
                  </div>
                  {g.items.map((c, i) => {
                    const idx = base + i
                    return (
                      <div
                        key={c.id}
                        className="wfp-cmdk-row"
                        data-active={idx === active || undefined}
                        onMouseEnter={() => setActive(idx)}
                        onMouseDown={() => run(idx)}
                      >
                        {c.icon != null && <span className="wfp-cmdk-row-icon">{c.icon}</span>}
                        <span style={{ minWidth: 0 }}>
                          <span className="wfp-cmdk-row-t">{c.label}</span>
                          {c.sub != null && <span className="wfp-cmdk-row-sub">{c.sub}</span>}
                        </span>
                        {c.kbd != null && <span className="wfp-cmdk-row-kbd">{c.kbd}</span>}
                      </div>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
        <div className="wfp-cmdk-foot">
          ↑↓ навігація · ↵ відкрити · esc закрити <span>{filtered.length}</span>
        </div>
      </div>
    </div>
  )
}
