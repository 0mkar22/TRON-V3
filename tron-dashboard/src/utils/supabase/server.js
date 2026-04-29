import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// 🌟 1. Make this function async
export async function createClient() {
  // 🌟 2. Await the cookies!
  const cookieStore = await cookies() 

  return createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored.
          }
        },
      },
    }
  )
}