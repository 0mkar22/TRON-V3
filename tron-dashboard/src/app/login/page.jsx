import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'

export default async function LoginPage({ searchParams }) {
  const resolvedParams = await searchParams

  // 🌟 SERVER ACTION: Log In Only
  const login = async (formData) => {
    'use server'
    const email = formData.get('email')
    const password = formData.get('password')
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return redirect('/login?message=Invalid login credentials')
    }
    return redirect('/')
  }

  // 🌟 SERVER ACTION: GitHub OAuth
  const signInWithGithub = async () => {
    'use server'
    const supabase = createClient()
    const origin = headers().get('origin')

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    })

    if (data.url) redirect(data.url)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-md border border-gray-100">
        
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Welcome back</h2>
          <p className="mt-2 text-sm text-gray-600">Sign in to manage your automated workflows</p>
        </div>

        {resolvedParams?.message && (
          <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm text-center font-medium">
            {resolvedParams.message}
          </div>
        )}

        <form action={signInWithGithub}>
          <button className="w-full flex justify-center py-2.5 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors">
            <span className="mr-2 text-lg">🐙</span> Continue with GitHub
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300" /></div>
          <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">Or continue with email</span></div>
        </div>

        <form className="mt-8 space-y-6" action={login}>
          <div className="rounded-md shadow-sm space-y-4">
            <input name="email" type="email" required placeholder="Email address" className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
            <input name="password" type="password" required placeholder="Password" className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>

          <button type="submit" className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none transition-colors shadow-sm">
            Sign in
          </button>
        </form>

        <div className="text-center mt-4">
          <Link href="/signup" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
            Dont have an account? Sign up
          </Link>
        </div>

      </div>
    </div>
  )
}