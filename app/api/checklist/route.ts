import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/** Upserts the signed-in user's checklist state (checked items + own items) for one tree. */
export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { treeId, checkedItemIds, customItems = {} } = body as {
      treeId: string
      checkedItemIds: string[]
      customItems?: Record<string, { id: string; label: string }[]>
    }

    if (
      !treeId ||
      !Array.isArray(checkedItemIds) ||
      !checkedItemIds.every((id) => typeof id === 'string') ||
      typeof customItems !== 'object' || customItems === null || Array.isArray(customItems) ||
      !Object.values(customItems).every((items) =>
        Array.isArray(items) &&
        items.every((i) => typeof i?.id === 'string' && typeof i?.label === 'string'),
      )
    ) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const { error } = await supabase
      .from('user_checklist')
      .upsert(
        {
          user_id: user.id,
          tree_id: treeId,
          checked_item_ids: checkedItemIds,
          custom_items: customItems,
          last_updated: new Date().toISOString(),
        },
        { onConflict: 'user_id,tree_id' }
      )

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[checklist/update]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
