import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function SignupPage({ searchParams }) {
  const resolvedParams = await searchParams

  // 🌟 SERVER ACTION: Minimal Sign Up
  const signup = async (formData) => {
    'use server'
    const email = formData.get('email')
    const password = formData.get('password')
    const supabase = await createClient()

    // Just email and password. We get the rest later!
    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      return redirect(`/signup?message=${error.message}`)
    }
    
    return redirect('/signup?message=Check your email to continue the sign in process')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-md border border-gray-100">
        
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Create an Account</h2>
          <p className="mt-2 text-sm text-gray-600">Start automating your workflows today</p>
        </div>

        {resolvedParams?.message && (
          <div className={`p-3 rounded-md text-sm text-center font-medium ${resolvedParams.message.includes('Check your email') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
            {resolvedParams.message}
          </div>
        )}

        <form className="mt-8 space-y-6" action={signup}>
          <div className="rounded-md shadow-sm space-y-4">
            <input name="email" type="email" required placeholder="Email address" className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
            <input name="password" type="password" required minLength="6" placeholder="Create a Password" className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>

          <button type="submit" className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none transition-colors shadow-sm">
            Continue ➔
          </button>
        </form>

        <div className="text-center mt-4">
          <Link href="/login" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
            Already have an account? Sign in
          </Link>
        </div>

      </div>
    </div>
  )
}