'use client'

import { useState } from 'react'
import type { ChecklistItem } from '@/types/tree'
import { newChecklistItemId } from '@/lib/builder-utils'

interface Props {
  items:    ChecklistItem[]
  onChange: (items: ChecklistItem[]) => void
}

const inputClass =
  'flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white ' +
  'placeholder-slate-600 focus:outline-none focus:border-[#00f0ff] focus:ring-1 ' +
  'focus:ring-[#00f0ff]/30 transition-all'

const iconButtonClass =
  'shrink-0 size-8 flex items-center justify-center rounded-lg text-slate-500 ' +
  'hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-30 disabled:pointer-events-none'

/** Edits a node's checklist — the sub-topics learners tick off in the viewer. */
export function ChecklistEditor({ items, onChange }: Props) {
  const [draft, setDraft] = useState('')

  function add(e: React.FormEvent) {
    e.preventDefault()
    const label = draft.trim()
    if (!label) return
    onChange([...items, { id: newChecklistItemId(), label }])
    setDraft('')
  }

  function rename(id: string, label: string) {
    onChange(items.map(item => (item.id === id ? { ...item, label } : item)))
  }

  function remove(id: string) {
    onChange(items.filter(item => item.id !== id))
  }

  function move(index: number, delta: -1 | 1) {
    const next = [...items]
    const [item] = next.splice(index, 1)
    next.splice(index + delta, 0, item)
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="text-xs text-slate-600 italic">
          No items yet. Break the skill into topics learners can tick off.
        </p>
      )}

      {items.map((item, i) => (
        <div key={item.id} className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-slate-600 text-base shrink-0">check_box_outline_blank</span>
          <input
            className={inputClass}
            value={item.label}
            placeholder="Item text"
            onChange={e => rename(item.id, e.target.value)}
          />
          <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className={iconButtonClass}>
            <span className="material-symbols-outlined text-base leading-none">arrow_upward</span>
          </button>
          <button type="button" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)} className={iconButtonClass}>
            <span className="material-symbols-outlined text-base leading-none">arrow_downward</span>
          </button>
          <button
            type="button"
            aria-label={`Delete "${item.label}"`}
            onClick={() => remove(item.id)}
            className={`${iconButtonClass} hover:!text-red-400`}
          >
            <span className="material-symbols-outlined text-base leading-none">close</span>
          </button>
        </div>
      ))}

      <form onSubmit={add} className="flex items-center gap-1.5 pt-1">
        <span className="material-symbols-outlined text-slate-600 text-base shrink-0">add</span>
        <input
          className={inputClass}
          value={draft}
          placeholder="Add an item, e.g. Loops: for, while"
          onChange={e => setDraft(e.target.value)}
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="shrink-0 px-3 py-2 rounded-lg text-xs font-bold text-[#00f0ff] bg-[#00f0ff]/10 border border-[#00f0ff]/30 hover:bg-[#00f0ff]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </form>
    </div>
  )
}
