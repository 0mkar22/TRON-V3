import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function OnboardingPage() {
  
  // 🌟 SERVER ACTION: Complete the Workspace Setup
  const completeSetup = async (formData) => {
    'use server'
    const fullName = formData.get('fullName')
    const companyName = formData.get('companyName')
    
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return redirect('/login')

    // 1. Update auth metadata so the Middleware bouncer lets them pass
    await supabase.auth.updateUser({
      data: {
        full_name: fullName,
        company_name: companyName,
      }
    })

    // 2. Create the Organization in your public database
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: companyName })
      .select()
      .single()

    // 3. Update the public user profile to link them to the organization
    if (org && !orgError) {
      await supabase
        .from('users')
        .update({ 
          full_name: fullName, 
          org_id: org.id 
        })
        .eq('id', user.id)
    }

    // 4. Release them into the Dashboard!
    return redirect('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg border border-gray-100">
        
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">🚀</span>
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900">Welcome to TRON</h2>
          <p className="mt-2 text-sm text-gray-600">Let&apos;s get your workspace set up.</p>
        </div>

        <form className="mt-8 space-y-6" action={completeSetup}>
          <div className="space-y-5">
            
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">What should we call you?</label>
              <input 
                name="fullName" 
                type="text" 
                required 
                placeholder="e.g. Jane Doe" 
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" 
              />
            </div>
            
            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">Company / Organization Name</label>
              <input 
                name="companyName" 
                type="text" 
                required 
                placeholder="e.g. Acme Corp" 
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm" 
              />
              <p className="mt-1 text-xs text-gray-500">You can invite your team to this workspace later.</p>
            </div>

          </div>

          <button 
            type="submit" 
            className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-bold rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors shadow-sm"
          >
            Go to Dashboard ➔
          </button>
        </form>

      </div>
    </div>
  )
}