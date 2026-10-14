import { create } from 'zustand'
import type { SkillTree, TreeNode, CanvasView, ChecklistItem } from '@/types/tree'
import type { UserProfile } from '@/types/user'
import { XP_PER_NODE, checklistKey } from '@/lib/utils'

const LS_GLOBAL_XP = 'globalXp'

function readGlobalXp(): number {
  if (typeof window === 'undefined') return 0
  return parseInt(localStorage.getItem(LS_GLOBAL_XP) ?? '0', 10) || 0
}

function saveGlobalXp(xp: number) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LS_GLOBAL_XP, String(xp))
}

/** User-added checklist items, keyed by node id. */
export type CustomChecklist = Record<string, ChecklistItem[]>

/** Saves checklist state locally and to the server (guests stay on localStorage only). */
function persistChecklist(treeId: string, checkedItemIds: string[], customItems: CustomChecklist) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`checklist:${treeId}`, JSON.stringify(checkedItemIds))
    localStorage.setItem(`checklist-custom:${treeId}`, JSON.stringify(customItems))
  }

  fetch('/api/checklist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ treeId, checkedItemIds, customItems }),
  }).catch(() => {/* Non-critical */})
}

interface SkillTreeState {
  // Auth
  user: UserProfile | null
  setUser: (user: UserProfile | null) => void

  // Tree data
  currentTree: SkillTree | null
  setCurrentTree: (tree: SkillTree | null) => void

  // Progress
  completedNodeIds: string[]
  setCompletedNodeIds: (ids: string[]) => void
  completeNode: (nodeId: string, treeId: string) => void
  uncompleteNode: (nodeId: string) => void

  // Checklist progress — keys are `${nodeId}/${itemId}` (see checklistKey)
  checkedItemIds: string[]
  setCheckedItemIds: (ids: string[]) => void
  toggleChecklistItem: (key: string, treeId: string) => void
  customChecklist: CustomChecklist
  setCustomChecklist: (items: CustomChecklist) => void
  addChecklistItem: (nodeId: string, label: string, treeId: string) => void
  removeChecklistItem: (nodeId: string, itemId: string, treeId: string) => void
  /** Unchecks everything but keeps the user's own items. */
  resetChecklist: (treeId: string) => void

  // Global XP — sum across all trees, persisted in localStorage
  // Hydrated from DB by UserMenu on mount; updated live by complete/uncomplete actions
  globalXp: number
  setGlobalXp: (xp: number) => void

  // UI state
  selectedNode: TreeNode | null
  setSelectedNode: (node: TreeNode | null) => void

  canvasView: CanvasView
  setCanvasView: (view: CanvasView) => void

  isSidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void

  // Hover-highlight a prereq node on the canvas from the sidebar
  hoveredPrereqId: string | null
  setHoveredPrereqId: (id: string | null) => void
}

export const useSkillTreeStore = create<SkillTreeState>((set, get) => ({
  // Auth
  user: null,
  setUser: (user) => set({ user }),

  // Tree data
  currentTree: null,
  setCurrentTree: (tree) => set({ currentTree: tree }),

  // Progress
  completedNodeIds: [],
  setCompletedNodeIds: (ids) => set({ completedNodeIds: ids }),

  completeNode: (nodeId, treeId) => {
    const prev = get().completedNodeIds
    if (prev.includes(nodeId)) return

    const next = [...prev, nodeId]
    const nextGlobalXp = get().globalXp + XP_PER_NODE
    set({ completedNodeIds: next, globalXp: nextGlobalXp })
    saveGlobalXp(nextGlobalXp)

    if (typeof window !== 'undefined') {
      localStorage.setItem(`progress:${treeId}`, JSON.stringify(next))
    }

    fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ treeId, completedNodeIds: next }),
    }).catch(() => {
      // Rollback on failure
      const rolledBack = get().globalXp - XP_PER_NODE
      set({ completedNodeIds: prev, globalXp: rolledBack })
      saveGlobalXp(rolledBack)
      if (typeof window !== 'undefined') {
        localStorage.setItem(`progress:${treeId}`, JSON.stringify(prev))
      }
    })
  },

  uncompleteNode: (nodeId) => {
    const treeId = get().currentTree?.treeId
    const newIds = get().completedNodeIds.filter((id) => id !== nodeId)
    const nextGlobalXp = Math.max(0, get().globalXp - XP_PER_NODE)
    set({ completedNodeIds: newIds, globalXp: nextGlobalXp })
    saveGlobalXp(nextGlobalXp)

    if (typeof window !== 'undefined' && treeId) {
      localStorage.setItem(`progress:${treeId}`, JSON.stringify(newIds))
    }

    if (treeId) {
      fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ treeId, completedNodeIds: newIds }),
      }).catch(() => {/* Non-critical */})
    }
  },

  checkedItemIds: [],
  setCheckedItemIds: (ids) => set({ checkedItemIds: ids }),

  toggleChecklistItem: (key, treeId) => {
    const prev = get().checkedItemIds
    const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    set({ checkedItemIds: next })
    persistChecklist(treeId, next, get().customChecklist)
  },

  customChecklist: {},
  setCustomChecklist: (items) => set({ customChecklist: items }),

  addChecklistItem: (nodeId, label, treeId) => {
    const trimmed = label.trim()
    if (!trimmed) return
    const item: ChecklistItem = { id: `c-${Date.now().toString(36)}`, label: trimmed }
    const prev = get().customChecklist
    const next = { ...prev, [nodeId]: [...(prev[nodeId] ?? []), item] }
    set({ customChecklist: next })
    persistChecklist(treeId, get().checkedItemIds, next)
  },

  removeChecklistItem: (nodeId, itemId, treeId) => {
    const prev = get().customChecklist
    const remaining = (prev[nodeId] ?? []).filter((item) => item.id !== itemId)
    const next = { ...prev }
    if (remaining.length > 0) next[nodeId] = remaining
    else delete next[nodeId]
    const key = checklistKey(nodeId, itemId)
    const checked = get().checkedItemIds.filter((k) => k !== key)
    set({ customChecklist: next, checkedItemIds: checked })
    persistChecklist(treeId, checked, next)
  },

  resetChecklist: (treeId) => {
    set({ checkedItemIds: [] })
    persistChecklist(treeId, [], get().customChecklist)
  },

  // Global XP — initialised from localStorage so it survives page refreshes
  globalXp: readGlobalXp(),
  setGlobalXp: (xp) => {
    set({ globalXp: xp })
    saveGlobalXp(xp)
  },

  // UI state
  selectedNode: null,
  setSelectedNode: (node) => set({ selectedNode: node, isSidebarOpen: node !== null }),

  canvasView: 'worldmap',
  setCanvasView: (view) => set({ canvasView: view }),

  isSidebarOpen: false,
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),

  hoveredPrereqId: null,
  setHoveredPrereqId: (id) => set({ hoveredPrereqId: id }),
}))
