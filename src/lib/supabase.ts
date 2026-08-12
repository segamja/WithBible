import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(
  url &&
    anonKey &&
    !url.includes('your-project') &&
    anonKey !== 'your-anon-key',
)

function createSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    // Placeholder client so the app boots before env is filled in.
    return createClient('https://placeholder.supabase.co', 'public-anon-key')
  }
  return createClient(url!, anonKey!)
}

export const supabase = createSupabase()
