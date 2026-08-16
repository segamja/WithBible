import { supabase } from '@/lib/supabase'

const BUCKET = 'wb-checkins'

function extensionOf(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && fromName.length <= 5) return fromName
  if (file.type.includes('png')) return 'png'
  if (file.type.includes('webp')) return 'webp'
  if (file.type.includes('heic') || file.type.includes('heif')) return 'heic'
  return 'jpg'
}

export async function uploadCheckinPhoto(userId: string, file: File): Promise<string> {
  const ext = extensionOf(file)
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/jpeg',
  })
  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/** Profile avatar under the same bucket (user folder RLS). Upserts fixed path. */
export async function uploadProfilePhoto(userId: string, file: File): Promise<string> {
  const ext = extensionOf(file)
  const path = `${userId}/avatar/profile.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '60',
    upsert: true,
    contentType: file.type || 'image/jpeg',
  })
  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  // bust CDN/browser cache after replace
  return `${data.publicUrl}?t=${Date.now()}`
}

/** Optional chatter photo; same user-folder RLS as check-in photos. */
export async function uploadChatterPhoto(userId: string, file: File): Promise<string> {
  const ext = extensionOf(file)
  const path = `${userId}/chatter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/jpeg',
  })
  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
