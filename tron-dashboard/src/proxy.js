import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function proxy(request) {
  // 1. Create an initial response object that we can attach cookies to
  let supabaseResponse = NextResponse.next({
    request,
  })

  // 2. Create the Supabase client specifically for middleware
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

  // 3. Securely check if a user is logged in
  const { data: { user } } = await supabase.auth.getUser()

  // 4. THE BOUNCER: If there is no user, and they aren't already on the login, signup, or auth pages...
  if (
    !user && 
    !request.nextUrl.pathname.startsWith('/login') && 
    !request.nextUrl.pathname.startsWith('/signup') && // 🌟 Added /signup here
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
    // ...kick them to the login page!
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 5. BONUS: If they ARE logged in, but try to go to the login or signup page, push them to the dashboard
  if (user && (request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/signup'))) { // 🌟 Added /signup here
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

// 6. Tell Next.js which routes to run this middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, SVGs, PNGs (public assets)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}