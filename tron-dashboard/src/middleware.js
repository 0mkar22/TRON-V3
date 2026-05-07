import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // ==========================================
  // 1. IF NOT LOGGED IN
  // ==========================================
  if (
    !user && 
    !pathname.startsWith('/login') && 
    !pathname.startsWith('/signup') && 
    !pathname.startsWith('/auth') &&
    // 🌟 FIX 1: Let unauthenticated users hit this page so the browser can read the #access_token!
    !pathname.startsWith('/onboarding/set-password') 
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // ==========================================
  // 2. IF LOGGED IN: The Onboarding Check
  // ==========================================
  if (user) {
    // 🌟 FIX 2: Admins need a company_name, but developers are considered "onboarded" by default!
    const hasCompletedOnboarding = !!user.user_metadata?.company_name || user.user_metadata?.role === 'developer';

    // A. If they HAVEN'T finished onboarding, force them to the /onboarding page
    if (!hasCompletedOnboarding && !pathname.startsWith('/onboarding') && !pathname.startsWith('/auth')) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }

    // B. If they HAVE finished onboarding, keep them away from auth and onboarding pages
    if (
        hasCompletedOnboarding && 
        (
            pathname.startsWith('/login') || 
            pathname.startsWith('/signup') || 
            // 🌟 FIX 3: Keep them away from Admin /onboarding, but let them finish setting their password!
            (pathname.startsWith('/onboarding') && !pathname.startsWith('/onboarding/set-password'))
        )
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}