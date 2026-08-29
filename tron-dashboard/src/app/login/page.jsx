import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function LoginPage({ searchParams }) {
  const resolvedParams = await searchParams

  // 🌟 SERVER ACTION: Log In Only
  const login = async (formData) => {
    'use server'
    const email = formData.get('email')
    const password = formData.get('password')
    const supabase = await createClient() // 🌟 Add await here!

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return redirect('/login?message=Invalid login credentials')
    }
    return redirect('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brutal-bg p-4 font-sans">
      <div className="max-w-md w-full bg-white border-4 border-black shadow-brutal-lg p-10 flex flex-col space-y-8">
        
        <div className="text-center border-b-4 border-black pb-6">
          <h2 className="text-5xl font-black uppercase tracking-tight text-black">System Login</h2>
          <p className="mt-4 text-sm font-bold font-mono text-black">AUTHENTICATE TO ACCESS WORKFLOWS</p>
        </div>

        {resolvedParams?.message && (
          <div className="bg-brutal-pink border-4 border-black text-black font-black uppercase p-3 text-center shadow-brutal">
            {resolvedParams.message}
          </div>
        )}

        <form className="space-y-6" action={login}>
          <div className="space-y-6">
            <div>
              <label className="block font-black text-xl mb-2 uppercase text-black">Identity (Email)</label>
              <input name="email" type="email" required placeholder="admin@acmecorp.com" className="input-brutal" />
            </div>
            <div>
              <label className="block font-black text-xl mb-2 uppercase text-black">Passphrase</label>
              <input name="password" type="password" required placeholder="••••••••" className="input-brutal" />
            </div>
          </div>

          <button type="submit" className="btn-brutal w-full py-4 bg-brutal-pink text-2xl mt-4 text-black">
            AUTHENTICATE
          </button>
        </form>

        <div className="text-center mt-4">
          <Link href="/signup" className="text-lg font-black uppercase text-black hover:text-brutal-blue underline decoration-4 underline-offset-4 transition-colors">
            CREATE NEW WORKSPACE
          </Link>
        </div>
      </div>
    </div>
  )
}