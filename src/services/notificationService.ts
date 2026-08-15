import { supabase } from '@/lib/supabase'
import { Tables } from '@/lib/tables'
import type { AppNotification } from '@/types'

export async function listMyNotifications(
  userId: string,
  limit = 40,
): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from(Tables.notifications)
    .select(
      `
      *,
      actor:wb_profiles!actor_id(id, name, profile_image)
    `,
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as AppNotification[]
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from(Tables.notifications)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function markNotificationRead(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from(Tables.notifications)
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from(Tables.notifications)
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)
  if (error) throw new Error(error.message)
}

export function subscribeNotifications(
  userId: string,
  onChange: () => void,
): () => void {
  const channel = supabase
    .channel(`wb-notif-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: Tables.notifications,
        filter: `user_id=eq.${userId}`,
      },
      () => onChange(),
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}
